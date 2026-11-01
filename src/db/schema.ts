import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { AgentTrace, Block, StatusLine } from "@/lib/blocks";

export type Role = "primary_caregiver" | "co_caregiver" | "parent";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

export const careProfiles = sqliteTable("care_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentName: text("parent_name").notNull(),
  dob: text("dob").notNull(),
  timezone: text("timezone").notNull(),
  insurancePlan: text("insurance_plan").notNull(),
  parentPhone: text("parent_phone").notNull().default(""),
  address: text("address").notNull().default(""),
  allergies: text("allergies", { mode: "json" }).$type<string[]>().notNull().default([]),
  pharmacy: text("pharmacy").notNull().default(""),
  wearableSource: text("wearable_source").$type<"apple_health" | "whoop">().notNull().default("apple_health"),
  // Per-parent overrides of the alert thresholds (see rules/alerts.ts).
  alertConfig: text("alert_config", { mode: "json" }).$type<Record<string, number>>(),
  // The agent's "Is Robert okay?" sentence for Home.
  statusLine: text("status_line", { mode: "json" }).$type<StatusLine>(),
});

export const memberships = sqliteTable("memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  role: text("role").$type<Role>().notNull(),
});

export const consents = sqliteTable("consents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  sharedData: text("shared_data", { mode: "json" }).$type<string[]>().notNull(),
  parentApprovalRequired: integer("parent_approval_required", { mode: "boolean" }).notNull(),
  grantedAt: text("granted_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  zocdocProviderId: text("zocdoc_provider_id").notNull(),
});

export const readings = sqliteTable("readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  source: text("source").notNull(),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  recordedAt: text("recorded_at").notNull(),
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  ruleId: text("rule_id").notNull(),
  severity: text("severity").$type<"info" | "watch" | "follow_up" | "urgent">().notNull(),
  status: text("status").notNull().default("open"),
  summary: text("summary"),
  evidence: text("evidence", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  providerId: integer("provider_id").notNull().references(() => providers.id),
  alertId: integer("alert_id").references(() => alerts.id),
  startAt: text("start_at").notNull(),
  zocdocConfirmation: text("zocdoc_confirmation"),
  status: text("status").$type<"booked" | "cancelled">().notNull().default("booked"),
  location: text("location").notNull().default(""),
  reason: text("reason"),
  calendarEventId: text("calendar_event_id"),
});

export const previsitBriefs = sqliteTable("previsit_briefs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  content: text("content", { mode: "json" }).$type<unknown>().notNull(),
  status: text("status").$type<"draft" | "approved" | "sent">().notNull().default("draft"),
  createdAt: text("created_at").notNull(),
});

export const briefQuestions = sqliteTable("brief_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  authorId: integer("author_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const visitSummaries = sqliteTable("visit_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const medications = sqliteTable("medications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  frequency: text("frequency").notNull(),
  daysSupply: integer("days_supply").notNull(),
  lastFillAt: text("last_fill_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const medChangeProposals = sqliteTable("med_change_proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitSummaryId: integer("visit_summary_id").notNull().references(() => visitSummaries.id),
  diff: text("diff", { mode: "json" }).$type<unknown>().notNull(),
  status: text("status").$type<"pending" | "confirmed" | "rejected">().notNull().default("pending"),
});

export const refills = sqliteTable("refills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicationId: integer("medication_id").notNull().references(() => medications.id),
  status: text("status").notNull(),
  requestedAt: text("requested_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ApprovalStatus = "pending" | "approved" | "declined" | "executed" | "failed";

export interface ApprovalDecision {
  userId: number;
  name: string;
  role: Role;
  decision: "approve" | "decline";
  at: string;
}

// Every external action needs one of these, approved by a person, before its tool will run.
export const approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  actionType: text("action_type").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  // Card text is built by code from the payload, so the model can't misdescribe the action.
  summary: text("summary", { mode: "json" }).$type<{ title: string; lines: string[] }>().notNull(),
  reason: text("reason"),
  status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
  parentRequired: integer("parent_required", { mode: "boolean" }).notNull().default(false),
  decisions: text("decisions", { mode: "json" }).$type<ApprovalDecision[]>().notNull().default([]),
  result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  requestedAt: text("requested_at").notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"),
  executedAt: text("executed_at"),
});

// One ongoing thread per care profile (not in PRD section 8; added for the chat-first UI).
// "event" messages are automated triggers (alerts, scheduled reviews) that woke the agent.
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careProfileId: integer("care_profile_id").notNull().references(() => careProfiles.id),
  role: text("role").$type<"assistant" | "user" | "event">().notNull(),
  authorId: integer("author_id").references(() => users.id),
  content: text("content").notNull(),
  // UI blocks the agent chose to render (see lib/blocks.ts).
  blocks: text("blocks", { mode: "json" }).$type<Block[]>().notNull().default([]),
  trace: text("trace", { mode: "json" }).$type<AgentTrace>(),
  createdAt: text("created_at").notNull(),
});
