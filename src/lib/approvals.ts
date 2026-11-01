import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { zocdoc, ZocdocError } from "@/fakes/zocdoc";
import { fmtSlot, now } from "./clock";
import { ToolError } from "./errors";

// The approval gate. Agent tools that touch the outside world call requireApproved() first, so they refuse
// to run without a person's approval no matter what the model does.

type Profile = typeof s.careProfiles.$inferSelect;
export type Approval = typeof s.approvals.$inferSelect;
export type ActionType = "book_appointment" | "cancel_appointment";

interface ActionSpec {
  // Actions the parent must also approve when their consent says bookings need their approval.
  parentApprovable: boolean;
  // Validates the request against current data; returns the stored payload and code-built card text.
  prepare(db: Db, profile: Profile, input: Record<string, unknown>): { payload: Record<string, unknown>; title: string; lines: string[] };
}

const ACTIONS: Record<ActionType, ActionSpec> = {
  book_appointment: {
    parentApprovable: true,
    prepare(_db, profile, input) {
      const slotId = String(input.slot_id ?? "");
      const providerId = slotId.split("@")[0];
      let provider;
      try {
        provider = zocdoc.getProvider(providerId);
      } catch (e) {
        throw new ToolError(e instanceof ZocdocError ? e.message : String(e));
      }
      const slot = zocdoc.searchSlots(providerId, now(), 60).find((x) => x.slotId === slotId);
      if (!slot) throw new ToolError(`slot ${slotId} is not open; search again`);
      if (!provider.accepts.includes(profile.insurancePlan)) {
        throw new ToolError(`${provider.name} doesn't accept ${profile.insurancePlan}; pick an in-network provider`);
      }
      return {
        payload: { slot_id: slotId, zocdoc_provider_id: providerId, start_at: slot.startAt, alert_id: input.alert_id ?? null },
        title: `Book ${provider.name}`,
        lines: [
          `${fmtSlot(slot.startAt, profile.timezone)} · ${provider.specialty}`,
          provider.address,
          `In network for ${profile.insurancePlan}`,
          "Adds it to the family calendar and notifies the care circle",
        ],
      };
    },
  },
  cancel_appointment: {
    parentApprovable: true,
    prepare(db, profile, input) {
      const appt = db.select({ a: s.appointments, provider: s.providers.name }).from(s.appointments)
        .innerJoin(s.providers, eq(s.providers.id, s.appointments.providerId))
        .where(and(eq(s.appointments.id, Number(input.appointment_id)), eq(s.appointments.careProfileId, profile.id))).get();
      if (!appt || appt.a.status !== "booked") throw new ToolError(`appointment ${input.appointment_id} is not a booked appointment`);
      return {
        payload: { appointment_id: appt.a.id, confirmation: appt.a.zocdocConfirmation },
        title: `Cancel ${appt.provider}`,
        lines: [fmtSlot(appt.a.startAt, profile.timezone), `Confirmation ${appt.a.zocdocConfirmation}`, "Removes it from the family calendar"],
      };
    },
  },
};

export const ACTION_TYPES = Object.keys(ACTIONS) as ActionType[];

export function consentActive(db: Db, careProfileId: number) {
  const consent = db.select().from(s.consents).where(eq(s.consents.careProfileId, careProfileId)).get();
  return Boolean(consent && !consent.revokedAt);
}

export function createApproval(db: Db, profile: Profile, action: ActionType, input: Record<string, unknown>, reason?: string): Approval {
  const spec = ACTIONS[action];
  if (!spec) throw new ToolError(`unknown action ${action}`);
  if (!consentActive(db, profile.id)) throw new ToolError(`${profile.parentName} has revoked consent; no actions can be taken`);
  const { payload, title, lines } = spec.prepare(db, profile, input);
  const consent = db.select().from(s.consents).where(eq(s.consents.careProfileId, profile.id)).get()!;
  return db.insert(s.approvals).values({
    careProfileId: profile.id,
    actionType: action,
    payload,
    summary: { title, lines },
    reason: reason || null,
    parentRequired: spec.parentApprovable && consent.parentApprovalRequired,
    requestedAt: now().toISOString(),
  }).returning().get();
}

export function getApproval(db: Db, approvalId: number) {
  return db.select().from(s.approvals).where(eq(s.approvals.id, approvalId)).get();
}

// Records one person's decision. A caregiver must approve, plus the parent when required; any decline wins.
export function decideApproval(db: Db, approvalId: number, userId: number, decision: "approve" | "decline") {
  const approval = getApproval(db, approvalId);
  if (!approval) throw new Error(`approval ${approvalId} not found`);
  if (approval.status !== "pending") throw new Error(`approval ${approvalId} is already ${approval.status}`);
  const member = db.select({ name: s.users.name, role: s.memberships.role }).from(s.memberships)
    .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
    .where(and(eq(s.memberships.userId, userId), eq(s.memberships.careProfileId, approval.careProfileId))).get();
  if (!member) throw new Error("only members of the care circle can decide");

  const decisions = [...approval.decisions.filter((d) => d.userId !== userId),
    { userId, name: member.name, role: member.role, decision, at: now().toISOString() }];
  const approvedBy = (roles: string[]) => decisions.find((d) => d.decision === "approve" && roles.includes(d.role));
  const caregiver = approvedBy(["primary_caregiver", "co_caregiver"]);
  const parentOk = !approval.parentRequired || approvedBy(["parent"]);

  const status = decision === "decline" ? "declined" : caregiver && parentOk ? "approved" : "pending";
  const updated = db.update(s.approvals).set({
    decisions,
    status,
    ...(status === "approved" ? { approvedBy: caregiver!.userId, approvedAt: now().toISOString() } : {}),
  }).where(eq(s.approvals.id, approvalId)).returning().get();
  return { approval: updated, member, waitingOn: status === "pending" ? (caregiver ? "parent" : "caregiver") : null };
}

// The gate every external tool calls. Returns the approved payload; the tool must act on it, not on model input.
export function requireApproved(db: Db, careProfileId: number, approvalId: unknown, action: ActionType): Approval {
  const approval = getApproval(db, Number(approvalId));
  if (!approval || approval.careProfileId !== careProfileId) throw new ToolError(`approval ${approvalId} not found`);
  if (approval.actionType !== action) throw new ToolError(`approval ${approval.id} is for ${approval.actionType}, not ${action}`);
  if (approval.status === "pending") throw new ToolError(`approval ${approval.id} is still waiting for the family's decision`);
  if (approval.status !== "approved") throw new ToolError(`approval ${approval.id} is ${approval.status}; it can't be used`);
  if (!consentActive(db, careProfileId)) throw new ToolError("consent has been revoked; no actions can be taken");
  return approval;
}

export function finishApproval(db: Db, approvalId: number, status: "executed" | "failed", result: Record<string, unknown>) {
  db.update(s.approvals).set({ status, result, executedAt: now().toISOString() }).where(eq(s.approvals.id, approvalId)).run();
}
