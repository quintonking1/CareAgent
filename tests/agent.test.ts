import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@/db";
import { seedDemo } from "@/db/seed";
import { MAX_TOOL_CALLS, runAgent } from "@/agent/careagent";
import { announceAlerts } from "@/agent/events";
import type { StreamEvent } from "@/lib/blocks";
import { applyScenario } from "@/lib/ingest";
import { getThread } from "@/lib/thread";
import { call, say, ScriptedLLM, use } from "./scripted-llm";

let db: Db;
let profileId: number;
let mayaId: number;

beforeEach(() => {
  db = createDb(":memory:");
  ({ profileId, mayaId } = seedDemo(db));
});

const ask = (text: string, llm: ScriptedLLM, onEvent?: (e: StreamEvent) => void) =>
  runAgent({ db, careProfileId: profileId, input: { kind: "message", userId: mayaId, text }, llm, onEvent });

describe("CareAgent tool loop", () => {
  it("lets the model choose tools, feeds results back, and saves the reply with a trace", async () => {
    const llm = new ScriptedLLM([
      use(call("get_readings", { metric: "sleep_hours", days: 7 }), call("get_medications")),
      (messages) => {
        const toolResults = messages.filter((m) => m.role === "tool");
        expect(toolResults).toHaveLength(2);
        expect(JSON.parse(String(toolResults[0].content)).readings).toHaveLength(7);
        return say("Robert slept about 7 hours a night this week.");
      },
    ]);
    const events: StreamEvent[] = [];
    const { input, reply } = await ask("How has Dad been sleeping?", llm, (e) => events.push(e));

    expect(input.role).toBe("user");
    expect(reply.content).toBe("Robert slept about 7 hours a night this week.");
    expect(reply.trace!.steps.map((s) => s.tool)).toEqual(["get_readings", "get_medications"]);
    expect(events.map((e) => e.type)).toEqual(["input", "step", "step", "delta", "done"]);
    // The model sees who is talking.
    expect(llm.seen[0].at(-1)).toMatchObject({ role: "user", content: "Maya Hayes: How has Dad been sleeping?" });
  });

  it("replaces text written before tool calls with the final answer", async () => {
    const llm = new ScriptedLLM([
      { content: "Let me pull up his chart.", toolCalls: [call("get_readings", { metric: "resting_hr", days: 7 })] },
      say("His resting heart rate averaged 64 bpm this week."),
    ]);
    const events: StreamEvent[] = [];
    const { reply } = await ask("Heart rate?", llm, (e) => events.push(e));
    expect(reply.content).toBe("His resting heart rate averaged 64 bpm this week.");
    expect(events.map((e) => e.type)).toEqual(["input", "delta", "reset", "step", "delta", "done"]);
  });

  it("render tools attach UI blocks to the reply", async () => {
    const llm = new ScriptedLLM([
      use(call("show_trend_chart", { metric: "resting_hr", days: 14 }), call("show_quick_replies", { options: ["Show sleep", "Any alerts?"] })),
      say("Here's his resting heart rate."),
    ]);
    const { reply } = await ask("Show me his heart rate", llm);
    expect(reply.blocks.map((b) => b.type)).toEqual(["trend", "quick_replies"]);
    expect(reply.blocks[0].type === "trend" && reply.blocks[0].points).toHaveLength(14);
  });

  it("on an alert event, saves a triage summary and status line through tools", async () => {
    const { alerts } = applyScenario(db, profileId, "rising_resting_hr");
    const id = alerts[0].id;
    const llm = new ScriptedLLM([
      use(call("get_alerts", { alert_id: id })),
      use(
        call("save_alert_summary", { alert_id: id, summary: "Resting heart rate rose to 78 bpm on Nov 1, above his usual 65. Consider a check-in with Dr. Patel." }),
        call("show_alert_card", { alert_id: id }),
        call("save_status_line", { text: "Mostly steady, but his resting heart rate has been higher than usual for 3 days.", source_alert_ids: [id], source_metrics: ["resting_hr"] }),
      ),
      say("Robert's resting heart rate has been higher than usual. This is not medical advice."),
    ]);
    await announceAlerts(db, alerts, llm);

    const alert = db.select().from(schema.alerts).where(eq(schema.alerts.id, id)).get()!;
    expect(alert.summary).toMatch(/This is not medical advice\.$/);
    const profile = db.select().from(schema.careProfiles).get()!;
    expect(profile.statusLine).toMatchObject({ sourceAlertIds: [id], sourceMetrics: ["resting_hr"] });
    const thread = getThread(db, profileId);
    expect(thread.map((m) => m.role)).toEqual(["event", "assistant"]);
    expect(thread[1].blocks[0]).toMatchObject({ type: "alert", alertId: id });
    // Events are labelled as automated, not as a person speaking.
    expect(llm.seen[0].at(-1)!.content).toMatch(/^\[Automated event\] Alert #\d+ fired/);
  });
});

describe("code-enforced guardrails", () => {
  it("tools reject diagnostic language and nothing is saved", async () => {
    const { alerts } = applyScenario(db, profileId, "irregular_rhythm");
    const llm = new ScriptedLLM([
      use(call("save_alert_summary", { alert_id: alerts[0].id, summary: "This looks like atrial fibrillation." })),
      (messages) => {
        expect(String(messages.at(-1)!.content)).toMatch(/Rejected: text uses diagnostic language/);
        return say("I noted the irregular rhythm notification.");
      },
    ]);
    const { reply } = await ask("Summarize the new alert", llm);
    expect(reply.trace!.steps[0]).toMatchObject({ tool: "save_alert_summary", ok: false });
    expect(db.select().from(schema.alerts).get()!.summary).toBeNull();
  });

  it("rejects summaries over 120 words", async () => {
    const { alerts } = applyScenario(db, profileId, "fall");
    const llm = new ScriptedLLM([
      use(call("save_alert_summary", { alert_id: alerts[0].id, summary: "word ".repeat(130) })),
      say("Noted."),
    ]);
    const { reply } = await ask("Summarize", llm);
    expect(reply.trace!.steps[0].ok).toBe(false);
  });

  it("makes the model rewrite a final reply that diagnoses", async () => {
    const llm = new ScriptedLLM([
      say("He probably has insomnia."),
      (messages) => {
        expect(String(messages.at(-1)!.content)).toMatch(/\[Automated check\].*diagnostic language/);
        return say("His sleep has been shorter than usual for three nights.");
      },
    ]);
    const events: StreamEvent[] = [];
    const { reply } = await ask("Why is he tired?", llm, (e) => events.push(e));
    expect(reply.content).toBe("His sleep has been shorter than usual for three nights.");
    expect(events.some((e) => e.type === "reset")).toBe(true);
  });

  it(`stops after ${MAX_TOOL_CALLS} tool calls and tells the caregiver`, async () => {
    const llm = new ScriptedLLM([use(call("get_medications"))], true);
    const { reply } = await ask("Loop forever", llm);
    expect(reply.trace!.steps).toHaveLength(MAX_TOOL_CALLS);
    expect(reply.trace!.error).toMatch(/15 tool calls/);
    expect(reply.content).toMatch(/couldn't finish/);
  });

  it("returns unknown tools and bad arguments to the model as errors instead of crashing", async () => {
    const llm = new ScriptedLLM([
      use(call("book_anything"), { id: "x", name: "get_readings", arguments: "{not json" }, call("get_readings", { metric: "mood", days: 3 })),
      say("Sorry, I can't do that yet."),
    ]);
    const { reply } = await ask("Book something", llm);
    expect(reply.trace!.steps.map((s) => s.ok)).toEqual([false, false, false]);
    expect(reply.trace!.error).toBeUndefined();
  });
});

describe("offline fallback", () => {
  it("still posts alerts to the thread without a model key", async () => {
    const { alerts } = applyScenario(db, profileId, "fall_no_movement");
    await announceAlerts(db, alerts);
    const thread = getThread(db, profileId);
    expect(thread.map((m) => m.role)).toEqual(["event", "assistant"]);
    expect(thread[1].blocks[0]).toMatchObject({ type: "alert", severity: "urgent" });
  });
});
