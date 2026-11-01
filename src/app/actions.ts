"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { seedDemo } from "@/db/seed";
import { SCENARIOS, type ScenarioName } from "@/fakes/wearables";
import { announceAlerts, runDailyReview } from "@/agent/events";
import { hasModelKey } from "@/agent/llm";
import { applyScenario, syncWearable } from "@/lib/ingest";
import { getCurrentProfile } from "@/lib/profile";
import { VIEWER_COOKIE } from "@/lib/viewer";
import { resolveAlert, runAlertEngine } from "@/rules/alerts";

export async function triggerScenario(formData: FormData) {
  const name = String(formData.get("scenario")) as ScenarioName;
  if (!(name in SCENARIOS)) throw new Error(`unknown scenario ${name}`);
  const db = getDb();
  const { alerts } = applyScenario(db, getCurrentProfile(db).id, name);
  await announceAlerts(db, alerts);
  revalidatePath("/", "layout");
  redirect("/");
}

// Pick up hand edits to data/fakes/wearables/*.json.
export async function syncDevice() {
  const db = getDb();
  const id = getCurrentProfile(db).id;
  syncWearable(db, id);
  await announceAlerts(db, runAlertEngine(db, id));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function dailyReview() {
  if (!hasModelKey()) throw new Error("Add OPENAI_API_KEY to .env to run the agent.");
  const db = getDb();
  await runDailyReview(db, getCurrentProfile(db).id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resetDemo() {
  seedDemo(getDb());
  revalidatePath("/", "layout");
  redirect("/");
}

export async function dismissAlert(alertId: number) {
  resolveAlert(getDb(), alertId);
  revalidatePath("/", "layout");
}

export async function setViewer(userId: number) {
  (await cookies()).set(VIEWER_COOKIE, String(userId), { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
