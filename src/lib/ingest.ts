import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { getWearableAdapter, resetDevice, uploadToDevice, WearableSimulator, type ScenarioName } from "@/fakes/wearables";
import { runAlertEngine } from "@/rules/alerts";
import { now } from "./clock";

function profileOf(db: Db, careProfileId: number) {
  const profile = db.select().from(s.careProfiles).where(eq(s.careProfiles.id, careProfileId)).get();
  if (!profile) throw new Error(`care profile ${careProfileId} not found`);
  return profile;
}

// Pulls everything the wearable adapter reports and upserts it into readings, keyed by metric + timestamp.
export function syncWearable(db: Db, careProfileId: number) {
  const profile = profileOf(db, careProfileId);
  const existing = new Map(
    db.select().from(s.readings).where(eq(s.readings.careProfileId, careProfileId)).all()
      .map((r) => [`${r.metric}|${r.recordedAt}`, r]),
  );
  let inserted = 0, updated = 0;
  for (const r of getWearableAdapter(profile.wearableSource).fetchReadings()) {
    const prev = existing.get(`${r.metric}|${r.recordedAt}`);
    if (!prev) {
      db.insert(s.readings).values({ ...r, careProfileId }).run();
      inserted++;
    } else if (prev.value !== r.value) {
      db.update(s.readings).set({ value: r.value }).where(eq(s.readings.id, prev.id)).run();
      updated++;
    }
  }
  return { inserted, updated };
}

// Demo reset: regenerate the device's 30-day history file, then sync it.
export function ingestHistory(db: Db, careProfileId: number, days = 30) {
  const profile = profileOf(db, careProfileId);
  const sim = new WearableSimulator(profile.wearableSource);
  resetDevice(profile.wearableSource, profile.parentName, sim.history(days, now()));
  return syncWearable(db, careProfileId);
}

// Simulates the device uploading a scenario's readings, syncs, and runs the alert rules.
// Returns the new alerts; announcing them is the agent's job (agent/events.ts).
export function applyScenario(db: Db, careProfileId: number, name: ScenarioName) {
  const profile = profileOf(db, careProfileId);
  uploadToDevice(profile.wearableSource, new WearableSimulator(profile.wearableSource).scenario(name, now()));
  const synced = syncWearable(db, careProfileId);
  return { ...synced, alerts: runAlertEngine(db, careProfileId) };
}
