import { beforeEach, describe, expect, it } from "vitest";
import { createDb, schema, type Db } from "@/db";
import { seedDemo } from "@/db/seed";
import { ASK_TOOLS, runAgent } from "@/agent/careagent";
import { resetState } from "@/fakes/store";
import { completeCheckout, requestRefill, rxDetails, WalgreensError } from "@/fakes/walgreens";
import { book, getAvailability, ZocdocPartnerError } from "@/fakes/zocdoc-partner";
import { homeView, INITIAL_STATE, SLOTS } from "@/lib/care-demo";
import { call, say, ScriptedLLM, use } from "./scripted-llm";

let db: Db;
let profileId: number;
let mayaId: number;

beforeEach(() => {
  db = createDb(":memory:");
  ({ profileId, mayaId } = seedDemo(db));
});

const askFromHome = (text: string, llm: ScriptedLLM) =>
  runAgent({ db, careProfileId: profileId, input: { kind: "message", userId: mayaId, text }, llm, surface: { kind: "ask", context: "Dad's resting heart rate tile: 72 bpm" } });

describe("ask surface (phone-first home)", () => {
  it("offers only read tools and adds the screen context to the system prompt", async () => {
    const llm = new ScriptedLLM([say("It has been above 70 for 5 days.")]);
    await askFromHome("Why is this flagged?", llm);
    expect(new Set(llm.toolsSeen[0])).toEqual(ASK_TOOLS);
    const system = String(llm.seen[0][0].content);
    expect(system).toContain("They are looking at: Dad's resting heart rate tile: 72 bpm");
    expect(system).toContain("You only have read tools here");
  });

  it("refuses an action tool even if the model calls it", async () => {
    const llm = new ScriptedLLM([
      use(call("request_approval", { action: "book_appointment", slot_id: "x" })),
      (messages) => {
        const result = JSON.parse(String(messages.at(-1)!.content));
        expect(result.error).toMatch(/unknown tool request_approval/);
        return say("Tap Book to confirm.");
      },
    ]);
    const { reply } = await askFromHome("Book it", llm);
    expect(reply.trace!.steps[0]).toMatchObject({ tool: "request_approval", ok: false });
    expect(db.select().from(schema.approvals).all()).toHaveLength(0);
  });

  it("keeps every tool in the classic chat", async () => {
    const llm = new ScriptedLLM([say("Hi")]);
    await runAgent({ db, careProfileId: profileId, input: { kind: "message", userId: mayaId, text: "hi" }, llm });
    expect(llm.toolsSeen[0]).toContain("request_approval");
  });
});

describe("fake Zocdoc Partner API", () => {
  beforeEach(() => resetState());

  it("returns in-network availability and books with an appointment_id", () => {
    const a = getAvailability("zd_cardio_001", "Blue Shield PPO");
    expect(a.insurance.in_network).toBe(true);
    expect(a.timeslots[0].start_time).toBe(SLOTS[0].startTime);
    const b = book({ provider_id: "zd_cardio_001", start_time: SLOTS[0].startTime, visit_type: "in_person",
      patient: { first_name: "Robert", last_name: "Hayes", date_of_birth: "1951-04-12" }, insurance: { plan: "Blue Shield PPO" } });
    expect(b.appointment_id).toMatch(/^zd_appt_/);
    expect(getAvailability("zd_cardio_001", "Blue Shield PPO").timeslots.map((s) => s.start_time)).not.toContain(SLOTS[0].startTime);
  });

  it("rejects out-of-network plans", () => {
    expect(() => book({ provider_id: "zd_cardio_001", start_time: SLOTS[0].startTime, visit_type: "in_person",
      patient: { first_name: "R", last_name: "H", date_of_birth: "1951-04-12" }, insurance: { plan: "Kaiser HMO" } })).toThrow(ZocdocPartnerError);
  });
});

describe("fake Walgreens Rx API", () => {
  it("refills an existing Rx by number and reports the WebView callback", () => {
    expect(requestRefill({ rxNumber: "4471", fulfillment: "pickup" }).landingUrl).toContain("rx=4471");
    expect(completeCheckout({ rxNumber: "4471", fulfillment: "delivery" }).callback).toBe("done");
    expect(rxDetails("4471").demoOnly).toBe(true);
  });

  it("can't refill a prescription it doesn't have", () => {
    expect(() => requestRefill({ rxNumber: "9999", fulfillment: "pickup" })).toThrow(WalgreensError);
  });
});

describe("home state", () => {
  it("shows two approvals by default and a status line after each flow", () => {
    expect(homeView(INITIAL_STATE).cards.map((c) => c.id)).toEqual(["booking", "refill"]);
    expect(homeView(INITIAL_STATE).needsCount).toBe(2);
    const booked = homeView({ ...INITIAL_STATE, booked: SLOTS[0] });
    expect(booked.status).toBe("Dr. Lee, Thu 10 AM, booked");
    expect(booked.appts[0].chip?.label).toBe("Brief Wed");
    expect(homeView({ ...INITIAL_STATE, refill: "ready" }).status).toBe("Lisinopril ready for pickup Wed");
    expect(homeView({ ...INITIAL_STATE, bookingSnoozed: true, refillSnoozed: true }).cards).toHaveLength(0);
  });
});
