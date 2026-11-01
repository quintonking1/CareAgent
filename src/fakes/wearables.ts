import { DAY_MS } from "@/lib/clock";
import { readJson, statePath, writeJson } from "./store";

// Fake wearables. A simulator writes each device's "cloud" as a JSON file under data/fakes/state/wearables/;
// adapters read only that file, the way a real adapter would read the vendor API. Nothing touches a network.

export type Metric = "resting_hr" | "hrv" | "sleep_hours" | "steps" | "irregular_rhythm" | "fall";
type DailyMetric = "resting_hr" | "hrv" | "sleep_hours" | "steps";
export type WearableSource = "apple_health" | "whoop";
export type ScenarioName = "rising_resting_hr" | "poor_sleep" | "fall" | "fall_no_movement" | "irregular_rhythm";

export const DAILY_METRICS: readonly Metric[] = ["resting_hr", "hrv", "sleep_hours", "steps"];

export const METRIC_INFO: Record<Metric, { label: string; unit: string }> = {
  resting_hr: { label: "Resting heart rate", unit: "bpm" },
  hrv: { label: "Heart rate variability", unit: "ms" },
  sleep_hours: { label: "Sleep", unit: "h" },
  steps: { label: "Steps", unit: "steps" },
  irregular_rhythm: { label: "Irregular rhythm notification", unit: "" },
  // 1 = fall with movement afterward, 2 = fall with no movement afterward
  fall: { label: "Fall event", unit: "" },
};

export const SCENARIOS: Record<ScenarioName, { label: string; description: string; metric: Metric }> = {
  rising_resting_hr: { label: "Rising resting heart rate", description: "5 days of resting heart rate climbing above baseline", metric: "resting_hr" },
  poor_sleep: { label: "Short sleep", description: "3 nights under 4 hours", metric: "sleep_hours" },
  fall: { label: "Fall (moved afterward)", description: "Watch detects a fall; Robert gets up", metric: "fall" },
  fall_no_movement: { label: "Fall (no movement)", description: "Watch detects a fall with no movement afterward", metric: "fall" },
  irregular_rhythm: { label: "Irregular rhythm notification", description: "Watch sends an irregular rhythm notification", metric: "irregular_rhythm" },
};

export interface ReadingInput {
  source: WearableSource;
  metric: Metric;
  value: number;
  recordedAt: string;
}

export interface WearableAdapter {
  readonly source: WearableSource;
  readonly metrics: readonly Metric[];
  fetchReadings(): ReadingInput[];
}

interface DeviceFile {
  device: string;
  owner: string;
  source: WearableSource;
  readings: Omit<ReadingInput, "source">[];
}

// Robert's typical values (synthetic).
const BASELINES: Record<DailyMetric, { mean: number; sd: number; decimals: number }> = {
  resting_hr: { mean: 64, sd: 1.5, decimals: 0 },
  hrv: { mean: 32, sd: 3, decimals: 0 },
  sleep_hours: { mean: 7, sd: 0.5, decimals: 1 },
  steps: { mean: 5600, sd: 900, decimals: 0 },
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number, decimals: number) => Number(v.toFixed(decimals));

// Daily metrics are stamped at 00:00 UTC of the day they describe.
function dayStamp(end: Date, daysAgo: number) {
  const d = new Date(end.getTime() - daysAgo * DAY_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Generates plausible synthetic data for a device. Only the simulator and tests use this directly.
export class WearableSimulator {
  constructor(
    readonly source: WearableSource,
    readonly metrics: readonly Metric[] = DEVICE_METRICS[source],
    private readonly seed = 42,
  ) {}

  history(days: number, end: Date): ReadingInput[] {
    const rand = mulberry32(this.seed);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const out: ReadingInput[] = [];
    for (let ago = days - 1; ago >= 0; ago--) {
      for (const metric of this.metrics) {
        if (!DAILY_METRICS.includes(metric)) continue;
        const b = BASELINES[metric as DailyMetric];
        out.push({ source: this.source, metric, value: round(b.mean + gauss() * b.sd, b.decimals), recordedAt: dayStamp(end, ago) });
      }
    }
    return out;
  }

  scenario(name: ScenarioName, end: Date): ReadingInput[] {
    const metric = SCENARIOS[name].metric;
    if (!this.metrics.includes(metric)) throw new Error(`${this.source} does not report ${metric}`);
    const reading = (value: number, recordedAt: string): ReadingInput => ({ source: this.source, metric, value, recordedAt });
    const eventAt = new Date(end.getTime() - 20 * 60_000).toISOString();

    switch (name) {
      case "rising_resting_hr":
        return [1.06, 1.1, 1.17, 1.19, 1.22].map((f, i) => reading(Math.round(BASELINES.resting_hr.mean * f), dayStamp(end, 4 - i)));
      case "poor_sleep":
        return [3.6, 3.4, 3.8].map((h, i) => reading(h, dayStamp(end, 2 - i)));
      case "fall":
        return [reading(1, eventAt)];
      case "fall_no_movement":
        return [reading(2, eventAt)];
      case "irregular_rhythm":
        return [reading(1, eventAt)];
    }
  }
}

export const DEVICE_METRICS: Record<WearableSource, readonly Metric[]> = {
  apple_health: ["resting_hr", "hrv", "sleep_hours", "steps", "irregular_rhythm", "fall"],
  // WHOOP has no fall detection, rhythm notifications, or step counts.
  whoop: ["resting_hr", "hrv", "sleep_hours"],
};

const DEVICE_NAMES: Record<WearableSource, string> = {
  apple_health: "Apple Watch (simulated)",
  whoop: "WHOOP 4.0 (simulated)",
};

export const deviceFilePath = (source: WearableSource) => statePath(`wearables/${source}.json`);

function readDeviceFile(source: WearableSource): DeviceFile {
  return readJson(deviceFilePath(source), { device: DEVICE_NAMES[source], owner: "", source, readings: [] });
}

function writeDeviceFile(data: DeviceFile) {
  data.readings.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.metric.localeCompare(b.metric));
  writeJson(deviceFilePath(data.source), data);
}

// Replaces the device's cloud with fresh history (demo reset).
export function resetDevice(source: WearableSource, owner: string, readings: ReadingInput[]) {
  writeDeviceFile({ device: DEVICE_NAMES[source], owner, source, readings: readings.map(({ source: _s, ...r }) => r) });
}

// Simulates the device uploading new readings. A daily reading replaces the one for the same metric and day.
export function uploadToDevice(source: WearableSource, readings: ReadingInput[]) {
  const data = readDeviceFile(source);
  const key = (r: { metric: string; recordedAt: string }) => `${r.metric}|${r.recordedAt}`;
  const incoming = new Set(readings.map(key));
  data.readings = data.readings.filter((r) => !incoming.has(key(r))).concat(readings.map(({ source: _s, ...r }) => r));
  writeDeviceFile(data);
}

class JsonWearableAdapter implements WearableAdapter {
  constructor(readonly source: WearableSource) {}
  get metrics() {
    return DEVICE_METRICS[this.source];
  }
  fetchReadings(): ReadingInput[] {
    return readDeviceFile(this.source).readings
      .filter((r) => this.metrics.includes(r.metric))
      .map((r) => ({ ...r, source: this.source }));
  }
}

export class FakeAppleHealthAdapter extends JsonWearableAdapter {
  constructor() {
    super("apple_health");
  }
}

export class FakeWhoopAdapter extends JsonWearableAdapter {
  constructor() {
    super("whoop");
  }
}

export function getWearableAdapter(source: WearableSource): WearableAdapter {
  return source === "whoop" ? new FakeWhoopAdapter() : new FakeAppleHealthAdapter();
}
