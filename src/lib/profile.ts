import type { Db } from "@/db";
import * as s from "@/db/schema";
import { seedDemo } from "@/db/seed";

const globalForDemo = globalThis as unknown as { __demoFresh?: boolean };

// The prototype has one care profile. Each server start reseeds a clean demo (no alerts, chat or
// status yet) so every run begins at the Demo controls. Set DEMO_PERSIST=1 to keep the previous state.
// The flag lives on globalThis so dev hot reloads don't wipe the demo mid-run.
export function getCurrentProfile(db: Db) {
  if (!globalForDemo.__demoFresh) {
    globalForDemo.__demoFresh = true;
    if (process.env.DEMO_PERSIST !== "1") seedDemo(db);
  }
  const existing = db.select().from(s.careProfiles).get();
  if (existing) return existing;
  seedDemo(db);
  return db.select().from(s.careProfiles).get()!;
}
