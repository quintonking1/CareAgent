import type { Db } from "./index";
import * as s from "./schema";
import { ingestHistory } from "@/lib/ingest";
import { resetState } from "@/fakes/store";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(Date.now() - n * DAY));

// Wipes and re-creates the synthetic demo family. All data is fake.
export function seedDemo(db: Db) {
  for (const t of [
    s.chatMessages, s.approvals, s.refills, s.medChangeProposals, s.visitSummaries, s.briefQuestions,
    s.previsitBriefs, s.appointments, s.alerts, s.readings, s.medications,
    s.providers, s.consents, s.memberships, s.careProfiles, s.users,
  ]) db.delete(t).run();
  resetState(); // fake services' bookings, calendar, outbox, device files

  const [maya, david, robert] = db.insert(s.users).values([
    { name: "Maya Hayes", email: "maya@example.com" },
    { name: "David Hayes", email: "david@example.com" },
    { name: "Robert Hayes", email: "robert@example.com" },
  ]).returning().all();

  const profile = db.insert(s.careProfiles).values({
    parentName: "Robert Hayes",
    dob: "1951-04-12",
    timezone: "America/Los_Angeles",
    insurancePlan: "Blue Shield PPO",
    parentPhone: "(555) 010-0142",
    address: "418 Alder Lane, Sacramento, CA",
    allergies: ["Penicillin"],
    pharmacy: "Valley Pharmacy (fake)",
    wearableSource: "apple_health",
  }).returning().get();

  db.insert(s.memberships).values([
    { userId: maya.id, careProfileId: profile.id, role: "primary_caregiver" },
    { userId: david.id, careProfileId: profile.id, role: "co_caregiver" },
    { userId: robert.id, careProfileId: profile.id, role: "parent" },
  ]).run();

  db.insert(s.consents).values({
    careProfileId: profile.id,
    sharedData: ["heart_rate", "hrv", "sleep", "steps", "falls", "irregular_rhythm", "medications"],
    parentApprovalRequired: false,
    grantedAt: daysAgo(60),
  }).run();

  db.insert(s.providers).values([
    { careProfileId: profile.id, name: "Dr. Anita Patel", specialty: "Primary Care", zocdocProviderId: "zd_pcp_001" },
    { careProfileId: profile.id, name: "Dr. Marcus Lee", specialty: "Cardiology", zocdocProviderId: "zd_cardio_001" },
  ]).run();

  db.insert(s.medications).values([
    { careProfileId: profile.id, name: "Lisinopril", dose: "10 mg", frequency: "once daily", daysSupply: 30, lastFillAt: daysAgo(24), active: true },
    { careProfileId: profile.id, name: "Metformin", dose: "500 mg", frequency: "twice daily", daysSupply: 90, lastFillAt: daysAgo(40), active: true },
    { careProfileId: profile.id, name: "Atorvastatin", dose: "20 mg", frequency: "once daily", daysSupply: 30, lastFillAt: daysAgo(12), active: true },
  ]).run();

  ingestHistory(db, profile.id, 30);


  return { profileId: profile.id, mayaId: maya.id };
}
