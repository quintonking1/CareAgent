import type { Db } from "@/db";
import * as s from "@/db/schema";
import { seedDemo } from "@/db/seed";

// The prototype has one care profile; seed it on first use so pages are never empty.
export function getCurrentProfile(db: Db) {
  const existing = db.select().from(s.careProfiles).get();
  if (existing) return existing;
  seedDemo(db);
  return db.select().from(s.careProfiles).get()!;
}
