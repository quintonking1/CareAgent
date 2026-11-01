import http from "node:http";
import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@/db";
import { seedDemo } from "@/db/seed";
import { runAgent } from "@/agent/careagent";
import { handleDecision } from "@/agent/events";
import { TOOLS, type ToolCtx } from "@/agent/tools";
import { familyCalendar } from "@/fakes/family-calendar";
import { messaging } from "@/fakes/messaging";
import { zocdoc } from "@/fakes/zocdoc";
import { createApproval, decideApproval } from "@/lib/approvals";
import { localDay, now } from "@/lib/clock";
import { ToolError } from "@/lib/errors";
import { applyScenario } from "@/lib/ingest";
import { call, say, ScriptedLLM, use } from "./scripted-llm";

let db: Db;
let profileId: number;
let ids: Record<"maya" | "david" | "robert", number>;

beforeEach(() => {
  db = createDb(":memory:");
  ({ profileId } = seedDemo(db));
  const users = db.select().from(schema.users).all();
  const id = (first: string) => users.find((u) => u.name.startsWith(first))!.id;
  ids = { maya: id("Maya"), david: id("David"), robert: id("Robert") };
});

const profile = () => db.select().from(schema.careProfiles).where(eq(schema.careProfiles.id, profileId)).get()!;
const ctx = (): ToolCtx => ({ db, profile: profile(), blocks: [], actorId: ids.maya });
const tool = (name: string, args: Record<string, unknown>) => TOOLS[name].run(args, ctx());
const firstPatelSlot = () => zocdoc.searchSlots("zd_pcp_001", now(), 14)[0];

describe("fake Zocdoc", () => {
  it("generates slots only inside the doctor's weekly hours, in their time zone", () => {
    const slots = zocdoc.searchSlots("zd_pcp_001", now(), 14);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const { weekday } = localDay(new Date(s.startAt), "America/Los_Angeles");
      expect(["tue", "thu", "fri"]).toContain(weekday);
      expect(Date.parse(s.startAt)).toBeGreaterThan(now().getTime());
    }
  });

  it("Dr. Lee has nothing in 14 days but does later", () => {
    expect(zocdoc.searchSlots("zd_cardio_001", now(), 14)).toEqual([]);
    expect(zocdoc.searchSlots("zd_cardio_001", now(), 30).length).toBeGreaterThan(0);
  });

  it("a booked slot disappears from search and comes back when cancelled", () => {
    const slot = firstPatelSlot();
    const b = zocdoc.book(slot.slotId, { name: "Robert Hayes", insurancePlan: "Blue Shield PPO" }, now());
    expect(b.confirmation).toMatch(/^ZD-[A-Z0-9]{6}$/);
    expect(zocdoc.searchSlots("zd_pcp_001", now(), 14).map((s) => s.slotId)).not.toContain(slot.slotId);
    expect(() => zocdoc.book(slot.slotId, { name: "Someone", insurancePlan: "Blue Shield PPO" }, now())).toThrow(/no longer available/);
    zocdoc.cancel(b.confirmation, now());
    expect(zocdoc.searchSlots("zd_pcp_001", now(), 14).map((s) => s.slotId)).toContain(slot.slotId);
  });

  it("search tool reports insurance and next availability", () => {
    const res = tool("zocdoc_search_slots", { specialty: "Cardiology", days: 14 }) as { provider: { name: string }; in_network: boolean; slots: unknown[]; next_available?: string }[];
    const lee = res.find((r) => r.provider.name === "Dr. Marcus Lee")!;
    expect(lee.slots).toEqual([]);
    expect(lee.next_available).toBeTruthy();
    const ortiz = (tool("zocdoc_search_slots", { zocdoc_provider_id: "zd_pcp_002" }) as { in_network: boolean }[])[0];
    expect(ortiz.in_network).toBe(false);
  });
});

describe("approval gate (enforced in the tool layer)", () => {
  it("booking tool refuses without an approval, while pending, and for the wrong action", () => {
    expect(() => tool("zocdoc_book_appointment", { approval_id: 999 })).toThrow(ToolError);
    const a = createApproval(db, profile(), "book_appointment", { slot_id: firstPatelSlot().slotId });
    expect(() => tool("zocdoc_book_appointment", { approval_id: a.id })).toThrow(/waiting for the family/);
    decideApproval(db, a.id, ids.maya, "approve");
    expect(() => tool("zocdoc_cancel_appointment", { approval_id: a.id })).toThrow(/is for book_appointment/);
    expect(db.select().from(schema.appointments).all()).toEqual([]);
  });

  it("books exactly the approved slot, once", () => {
    const slot = firstPatelSlot();
    const a = createApproval(db, profile(), "book_appointment", { slot_id: slot.slotId });
    decideApproval(db, a.id, ids.david, "approve"); // co-caregivers can approve
    const res = tool("zocdoc_book_appointment", { approval_id: a.id, slot_id: "something-else" }) as { appointment_id: number };
    const appt = db.select().from(schema.appointments).where(eq(schema.appointments.id, res.appointment_id)).get()!;
    expect(appt.startAt).toBe(slot.startAt);
    expect(db.select().from(schema.approvals).get()!.status).toBe("executed");
    expect(() => tool("zocdoc_book_appointment", { approval_id: a.id })).toThrow(/executed/);
  });

  it("declined approvals can't be used", () => {
    const a = createApproval(db, profile(), "book_appointment", { slot_id: firstPatelSlot().slotId });
    decideApproval(db, a.id, ids.maya, "decline");
    expect(() => tool("zocdoc_book_appointment", { approval_id: a.id })).toThrow(/declined/);
  });

  it("won't request approval for an out-of-network doctor or a taken slot", () => {
    const ortiz = zocdoc.searchSlots("zd_pcp_002", now(), 14)[0];
    expect(() => createApproval(db, profile(), "book_appointment", { slot_id: ortiz.slotId })).toThrow(/doesn't accept/);
    expect(() => createApproval(db, profile(), "book_appointment", { slot_id: "zd_pcp_001@2020-01-01T09:00" })).toThrow(/not open/);
  });

  it("needs the parent too when consent says so", () => {
    db.update(schema.consents).set({ parentApprovalRequired: true }).run();
    const a = createApproval(db, profile(), "book_appointment", { slot_id: firstPatelSlot().slotId });
    expect(decideApproval(db, a.id, ids.maya, "approve")).toMatchObject({ waitingOn: "parent", approval: { status: "pending" } });
    expect(decideApproval(db, a.id, ids.robert, "approve").approval.status).toBe("approved");
  });

  it("blocks all actions once consent is revoked", () => {
    const a = createApproval(db, profile(), "book_appointment", { slot_id: firstPatelSlot().slotId });
    decideApproval(db, a.id, ids.maya, "approve");
    db.update(schema.consents).set({ revokedAt: now().toISOString() }).run();
    expect(() => tool("zocdoc_book_appointment", { approval_id: a.id })).toThrow(/consent/);
    expect(() => createApproval(db, profile(), "book_appointment", { slot_id: firstPatelSlot().slotId })).toThrow(/revoked/);
  });
});

describe("the agent's booking loop", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spies: MockInstance<(...args: any[]) => any>[] = [];
  beforeEach(() => {
    const boom = () => { throw new Error("outbound network call during booking"); };
    spies = [vi.spyOn(globalThis, "fetch").mockImplementation(boom), vi.spyOn(http, "request").mockImplementation(boom), vi.spyOn(https, "request").mockImplementation(boom)];
  });
  afterEach(() => spies.forEach((s) => s.mockRestore()));

  it("alert -> slots -> approval -> booked, on the calendar, David notified; no outbound HTTP", async () => {
    const { alerts } = applyScenario(db, profileId, "rising_resting_hr");
    const alertId = alerts[0].id;
    const [s1, s2, s3] = zocdoc.searchSlots("zd_pcp_001", now(), 14);

    // 1. Caregiver taps "Book follow-up": the agent searches and shows three times.
    await runAgent({ db, careProfileId: profileId, input: { kind: "message", userId: ids.maya, text: `Book a follow-up for alert #${alertId}` },
      llm: new ScriptedLLM([
        use(call("get_providers"), call("zocdoc_search_slots", { zocdoc_provider_id: "zd_pcp_001", days: 14 })),
        use(call("show_slot_picker", { slot_ids: [s1.slotId, s2.slotId, s3.slotId] })),
        say("Dr. Patel has these openings."),
      ]) });

    // 2. Caregiver taps a time: the agent asks for approval and stops.
    const { reply } = await runAgent({ db, careProfileId: profileId, input: { kind: "message", userId: ids.maya, text: `Book slot ${s2.slotId}` },
      llm: new ScriptedLLM([
        use(call("request_approval", { action: "book_appointment", slot_id: s2.slotId, alert_id: alertId, reason: "Follow-up on his higher resting heart rate." })),
        (messages) => {
          // A premature booking attempt is refused by the tool, not by the prompt.
          expect(JSON.parse(String(messages.at(-1)!.content))).toMatchObject({ status: "pending" });
          return use(call("zocdoc_book_appointment", { approval_id: 1 }));
        },
        say("Waiting for your approval."),
      ]) });
    expect(reply.trace!.steps.map((s) => [s.tool, s.ok])).toEqual([["request_approval", true], ["zocdoc_book_appointment", false]]);
    expect(reply.blocks[0]).toMatchObject({ type: "approval", title: "Book Dr. Anita Patel", status: "pending" });
    expect(db.select().from(schema.appointments).all()).toEqual([]);

    // 3. Caregiver taps Approve: the agent books, adds to the calendar, notifies David.
    const approvalId = (reply.blocks[0] as { approvalId: number }).approvalId;
    const res = await handleDecision(db, approvalId, ids.maya, "approve", {
      llm: new ScriptedLLM([
        use(call("zocdoc_book_appointment", { approval_id: approvalId })),
        (messages) => {
          const { appointment_id } = JSON.parse(String(messages.at(-1)!.content));
          return use(
            call("add_to_family_calendar", { appointment_id }),
            call("notify_care_circle", { text: "Maya booked Robert with Dr. Patel." }),
            call("show_appointment_card", { appointment_id }),
          );
        },
        say("Booked."),
      ]),
    });
    expect(res.ran).toBe(true);

    const appt = db.select().from(schema.appointments).get()!;
    expect(appt).toMatchObject({ startAt: s2.startAt, alertId, status: "booked" });
    expect(db.select().from(schema.alerts).get()!.status).toBe("follow_up_booked");
    expect(appt.zocdocConfirmation).toMatch(/^ZD-/);
    expect(familyCalendar.list()).toHaveLength(1);
    expect(familyCalendar.list()[0].attendees).toContain("David Hayes");
    expect(messaging.inbox(ids.david).map((m) => m.text)).toEqual(["Maya booked Robert with Dr. Patel."]);
    expect(messaging.inbox(ids.maya)).toEqual([]); // the actor isn't notified of their own action
    expect(zocdoc.searchSlots("zd_pcp_001", now(), 14).map((s) => s.slotId)).not.toContain(s2.slotId);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("notifications never go to the parent", () => {
    expect(() => tool("notify_care_circle", { text: "hi", user_ids: [ids.robert] })).toThrow(/no caregivers/);
  });
});
