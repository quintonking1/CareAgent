import { beforeEach, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@/db";
import { seedDemo } from "@/db/seed";
import fs from "node:fs";
import { applyScenario, syncWearable } from "@/lib/ingest";
import { deviceFilePath } from "@/fakes/wearables";
import { RULES, runAlertEngine, type Evidence } from "@/rules/alerts";

let db: Db;
let profileId: number;

beforeEach(() => {
  db = createDb(":memory:");
  ({ profileId } = seedDemo(db));
});

const readingCount = () => db.select({ n: count() }).from(schema.readings).get()!.n;

describe("alert engine", () => {
  it("raises nothing on normal seeded history", () => {
    expect(runAlertEngine(db, profileId)).toEqual([]);
  });

  it("rising resting HR -> follow_up with baseline and the elevated readings as evidence", () => {
    const { alerts } = applyScenario(db, profileId, "rising_resting_hr");
    expect(alerts).toHaveLength(1);
    const [a] = alerts;
    expect(a.ruleId).toBe("resting_hr_elevated");
    expect(a.severity).toBe("follow_up");
    const ev = a.evidence as Evidence;
    expect(ev.readings.length).toBeGreaterThanOrEqual(3);
    expect(ev.baseline!.value).toBeGreaterThan(60);
    for (const r of ev.readings) expect(r.value).toBeGreaterThanOrEqual(ev.threshold!);
  });

  it("scenario replaces the daily readings it overlaps instead of duplicating days", () => {
    const before = readingCount();
    applyScenario(db, profileId, "rising_resting_hr");
    expect(readingCount()).toBe(before);
    applyScenario(db, profileId, "fall");
    expect(readingCount()).toBe(before + 1);
  });

  it("does not duplicate open alerts when re-run", () => {
    applyScenario(db, profileId, "rising_resting_hr");
    applyScenario(db, profileId, "fall");
    expect(runAlertEngine(db, profileId)).toEqual([]);
  });

  it.each([
    ["fall", "fall_detected", "follow_up"],
    ["fall_no_movement", "fall_no_movement", "urgent"],
    ["irregular_rhythm", "irregular_rhythm", "follow_up"],
    ["poor_sleep", "sleep_short", "watch"],
  ] as const)("%s -> %s (%s)", (scenario, ruleId, severity) => {
    const { alerts } = applyScenario(db, profileId, scenario);
    expect(alerts.map((a) => [a.ruleId, a.severity])).toEqual([[ruleId, severity]]);
    expect((alerts[0].evidence as Evidence).readings.length).toBeGreaterThan(0);
  });

  it("respects per-parent threshold overrides", () => {
    db.update(schema.careProfiles).set({ alertConfig: { restingHrPctAbove: 0.5 } })
      .where(eq(schema.careProfiles.id, profileId)).run();
    expect(applyScenario(db, profileId, "rising_resting_hr").alerts).toEqual([]);
  });

  it("never uses diagnostic language", () => {
    const banned = /diagnos|afib|atrial|fibrillation|arrhythmia|heart attack|disease|insomnia|tachycardia|condition/i;
    for (const sc of ["rising_resting_hr", "poor_sleep", "fall", "fall_no_movement", "irregular_rhythm"] as const) {
      applyScenario(db, profileId, sc);
    }
    const alerts = db.select().from(schema.alerts).all();
    expect(alerts).toHaveLength(5);
    for (const a of alerts) expect((a.evidence as Evidence).description).not.toMatch(banned);
    for (const r of Object.values(RULES)) expect(r.label).not.toMatch(banned);
  });

  it("picks up hand edits to the device JSON file on sync", () => {
    const file = deviceFilePath("apple_health");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const last = data.readings.filter((r: { metric: string }) => r.metric === "resting_hr").at(-1);
    last.value = 99;
    fs.writeFileSync(file, JSON.stringify(data));
    expect(syncWearable(db, profileId)).toEqual({ inserted: 0, updated: 1 });
    const stored = db.select().from(schema.readings).all().find((r) => r.metric === "resting_hr" && r.recordedAt === last.recordedAt);
    expect(stored!.value).toBe(99);
  });
});
