import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deviceFilePath, FakeAppleHealthAdapter, FakeWhoopAdapter, resetDevice, uploadToDevice, WearableSimulator,
} from "@/fakes/wearables";

const end = new Date("2026-11-01T15:00:00Z");

describe("wearable simulator", () => {
  it("produces 30 days of each daily metric in plausible ranges", () => {
    const rs = new WearableSimulator("apple_health").history(30, end);
    const ranges: Record<string, [number, number]> = {
      resting_hr: [55, 75], hrv: [15, 50], sleep_hours: [4.5, 9.5], steps: [1500, 10000],
    };
    for (const [metric, [lo, hi]] of Object.entries(ranges)) {
      const values = rs.filter((r) => r.metric === metric).map((r) => r.value);
      expect(values).toHaveLength(30);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("is deterministic and never stamps the future", () => {
    const sim = new WearableSimulator("apple_health");
    expect(sim.history(30, end)).toEqual(new WearableSimulator("apple_health").history(30, end));
    for (const r of [...sim.history(30, end), ...sim.scenario("rising_resting_hr", end), ...sim.scenario("fall", end)]) {
      expect(new Date(r.recordedAt).getTime()).toBeLessThanOrEqual(end.getTime());
    }
  });

  it("WHOOP has no steps and rejects fall scenarios", () => {
    const whoop = new WearableSimulator("whoop");
    expect(whoop.history(30, end).some((r) => r.metric === "steps")).toBe(false);
    expect(() => whoop.scenario("fall", end)).toThrow(/does not report fall/);
  });
});

describe("JSON-backed adapters", () => {
  it("read exactly what is in the device file", () => {
    const sim = new WearableSimulator("apple_health");
    resetDevice("apple_health", "Robert Hayes", sim.history(30, end));
    const file = JSON.parse(fs.readFileSync(deviceFilePath("apple_health"), "utf8"));
    expect(file.owner).toBe("Robert Hayes");
    expect(new FakeAppleHealthAdapter().fetchReadings()).toHaveLength(file.readings.length);
  });

  it("uploads replace same-day daily readings and append events", () => {
    const sim = new WearableSimulator("apple_health");
    resetDevice("apple_health", "Robert Hayes", sim.history(30, end));
    const before = new FakeAppleHealthAdapter().fetchReadings().length;
    uploadToDevice("apple_health", sim.scenario("rising_resting_hr", end));
    expect(new FakeAppleHealthAdapter().fetchReadings()).toHaveLength(before);
    uploadToDevice("apple_health", sim.scenario("fall", end));
    expect(new FakeAppleHealthAdapter().fetchReadings()).toHaveLength(before + 1);
  });

  it("WHOOP adapter ignores metrics WHOOP doesn't report, even if present in its file", () => {
    resetDevice("whoop", "Robert Hayes", new WearableSimulator("apple_health").history(3, end).map((r) => ({ ...r, source: "whoop" })));
    expect(new FakeWhoopAdapter().fetchReadings().some((r) => r.metric === "steps")).toBe(false);
  });
});
