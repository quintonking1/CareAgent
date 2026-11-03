import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { DAILY_METRICS, METRIC_INFO, type Metric } from "@/fakes/wearables";
import type { Block } from "@/lib/blocks";
import { DAY_MS, dateKey, now } from "@/lib/clock";
import { alertBlock, series } from "@/lib/thread";
import { getVitals } from "@/lib/overview";
import { RULES, type Evidence, type RuleId } from "@/rules/alerts";
import { ACTION_TYPES, createApproval, finishApproval, requireApproved, type ActionType } from "@/lib/approvals";
import { ToolError } from "@/lib/errors";
import { fmtSlot } from "@/lib/clock";
import { familyCalendar } from "@/fakes/family-calendar";
import { messaging } from "@/fakes/messaging";
import { zocdoc, ZocdocError } from "@/fakes/zocdoc";
import { DISCLAIMER, wellnessViolation, wordCount } from "./safety";
import type { ToolDef } from "./llm";

type Profile = typeof s.careProfiles.$inferSelect;

export interface ToolCtx {
  db: Db;
  profile: Profile;
  // Blocks the agent chose to render in its reply, in order.
  blocks: Block[];
  // The person whose message or approval started this run, if any.
  actorId?: number;
}

interface Tool {
  description: string;
  parameters: Record<string, unknown>;
  label: (args: Record<string, unknown>) => string;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => unknown;
}

export { ToolError };

const METRICS = Object.keys(METRIC_INFO) as Metric[];
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});
const int = (v: unknown, fallback: number) => (Number.isInteger(v) ? (v as number) : fallback);
const metricArg = (v: unknown): Metric => {
  if (!METRICS.includes(v as Metric)) throw new ToolError(`metric must be one of ${METRICS.join(", ")}`);
  return v as Metric;
};
const firstName = (p: Profile) => p.parentName.split(" ")[0];

function getAlert(ctx: ToolCtx, id: unknown) {
  const alert = ctx.db.select().from(s.alerts)
    .where(and(eq(s.alerts.id, int(id, -1)), eq(s.alerts.careProfileId, ctx.profile.id))).get();
  if (!alert) throw new ToolError(`alert ${id} not found`);
  return alert;
}

function getAppointment(ctx: ToolCtx, id: unknown) {
  const row = ctx.db.select({ a: s.appointments, p: s.providers }).from(s.appointments)
    .innerJoin(s.providers, eq(s.providers.id, s.appointments.providerId))
    .where(and(eq(s.appointments.id, int(id, -1)), eq(s.appointments.careProfileId, ctx.profile.id))).get();
  if (!row) throw new ToolError(`appointment ${id} not found`);
  return row;
}

function appointmentBlock(ctx: ToolCtx, id: number): Block {
  const { a, p } = getAppointment(ctx, id);
  return {
    type: "appointment", appointmentId: a.id, providerName: p.name, specialty: p.specialty, startAt: a.startAt,
    location: a.location, confirmation: a.zocdocConfirmation ?? "", status: a.status, timeZone: ctx.profile.timezone,
    onCalendar: Boolean(a.calendarEventId),
  };
}

function zocdocCall<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ZocdocError) throw new ToolError(`Zocdoc: ${e.message}`);
    throw e;
  }
}

function checkWellness(text: string) {
  const v = wellnessViolation(text);
  if (v) throw new ToolError(`Rejected: text ${v}. Describe changes in readings instead; never diagnose or advise on doses.`);
}

export const TOOLS: Record<string, Tool> = {
  // ---------- read ----------
  get_care_profile: {
    description: "Parent details, consent settings, care circle members, and doctors.",
    parameters: obj(),
    label: () => "Reading the care profile",
    run: (_a, { db, profile }) => {
      const consent = db.select().from(s.consents).where(eq(s.consents.careProfileId, profile.id)).get();
      const circle = db.select({ name: s.users.name, role: s.memberships.role }).from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId)).where(eq(s.memberships.careProfileId, profile.id)).all();
      const providers = db.select().from(s.providers).where(eq(s.providers.careProfileId, profile.id)).all();
      return {
        parent: {
          name: profile.parentName, dob: profile.dob, phone: profile.parentPhone, address: profile.address,
          allergies: profile.allergies, insurance: profile.insurancePlan, pharmacy: profile.pharmacy,
          wearable: profile.wearableSource, timezone: profile.timezone,
        },
        consent: consent && {
          shared_data: consent.sharedData, parent_approval_required: consent.parentApprovalRequired,
          granted_at: consent.grantedAt, revoked: Boolean(consent.revokedAt),
        },
        care_circle: circle,
        providers: providers.map((p) => ({ id: p.id, name: p.name, specialty: p.specialty })),
      };
    },
  },

  get_readings: {
    description: "Wearable readings for one metric over the last N days (max 30), with reading ids and summary stats. Daily metrics have one reading per day; fall and irregular_rhythm are events (fall value 1 = moved afterward, 2 = no movement afterward).",
    parameters: obj({
      metric: { type: "string", enum: METRICS },
      days: { type: "integer", minimum: 1, maximum: 30 },
    }, ["metric", "days"]),
    label: (a) => `Checking ${METRIC_INFO[a.metric as Metric]?.label.toLowerCase() ?? "readings"} (${a.days ?? 14} days)`,
    run: (a, { db, profile }) => {
      const metric = metricArg(a.metric);
      const days = Math.min(30, Math.max(1, int(a.days, 14)));
      const since = new Date(now().getTime() - days * DAY_MS).toISOString();
      const rows = db.select().from(s.readings)
        .where(and(eq(s.readings.careProfileId, profile.id), eq(s.readings.metric, metric))).all()
        .filter((r) => r.recordedAt >= since)
        .sort((x, y) => x.recordedAt.localeCompare(y.recordedAt));
      const values = rows.map((r) => r.value);
      const daily = DAILY_METRICS.includes(metric);
      return {
        metric, unit: METRIC_INFO[metric].unit,
        readings: rows.map((r) => ({ id: r.id, [daily ? "date" : "at"]: daily ? dateKey(r.recordedAt) : r.recordedAt, value: r.value })),
        summary: values.length && daily ? {
          count: values.length,
          mean: Number((values.reduce((x, y) => x + y, 0) / values.length).toFixed(1)),
          min: Math.min(...values), max: Math.max(...values),
        } : { count: values.length },
      };
    },
  },

  get_alerts: {
    description: "Alerts from the rule engine with the rule that fired, the evidence readings, and any saved triage summary. Defaults to open alerts (status open; follow_up_booked and resolved are handled).",
    parameters: obj({
      status: { type: "string", enum: ["open", "all"] },
      alert_id: { type: "integer" },
    }),
    label: (a) => (a.alert_id ? `Looking at alert #${a.alert_id}` : "Checking alerts"),
    run: (a, ctx) => {
      const rows = a.alert_id ? [getAlert(ctx, a.alert_id)]
        : ctx.db.select().from(s.alerts).where(and(
            eq(s.alerts.careProfileId, ctx.profile.id),
            a.status === "all" ? undefined : eq(s.alerts.status, "open"),
          )).orderBy(desc(s.alerts.createdAt)).all();
      return rows.map((al) => {
        const ev = al.evidence as Evidence;
        return {
          id: al.id, rule: al.ruleId, label: RULES[al.ruleId as RuleId].label, severity: al.severity,
          status: al.status, created_at: al.createdAt, description: ev.description,
          evidence_readings: ev.readings, baseline: ev.baseline, threshold: ev.threshold,
          triage_summary: al.summary,
        };
      });
    },
  },

  get_medications: {
    description: "Current medication list with days of supply left and run-out dates.",
    parameters: obj(),
    label: () => "Checking medications",
    run: (_a, { db, profile }) =>
      db.select().from(s.medications)
        .where(and(eq(s.medications.careProfileId, profile.id), eq(s.medications.active, true))).all()
        .map((m) => {
          const runsOut = new Date(new Date(m.lastFillAt).getTime() + m.daysSupply * DAY_MS);
          return {
            id: m.id, name: m.name, dose: m.dose, frequency: m.frequency, days_supply: m.daysSupply,
            last_fill: dateKey(m.lastFillAt), runs_out: dateKey(runsOut.toISOString()),
            days_left: Math.ceil((runsOut.getTime() - now().getTime()) / DAY_MS),
          };
        }),
  },

  get_appointments: {
    description: "Upcoming and past appointments.",
    parameters: obj(),
    label: () => "Checking appointments",
    run: (_a, { db, profile }) =>
      db.select({ a: s.appointments, provider: s.providers.name }).from(s.appointments)
        .innerJoin(s.providers, eq(s.providers.id, s.appointments.providerId))
        .where(eq(s.appointments.careProfileId, profile.id)).all()
        .map(({ a, provider }) => ({
          id: a.id, provider, start_at: a.startAt, status: a.status, confirmation: a.zocdocConfirmation, alert_id: a.alertId,
        })),
  },

  get_providers: {
    description: "The parent's doctors and their Zocdoc provider ids.",
    parameters: obj(),
    label: () => "Looking up doctors",
    run: (_a, { db, profile }) =>
      db.select().from(s.providers).where(eq(s.providers.careProfileId, profile.id)).all()
        .map((p) => ({ id: p.id, name: p.name, specialty: p.specialty, zocdoc_provider_id: p.zocdocProviderId })),
  },

  // ---------- internal writes ----------
  save_alert_summary: {
    description: `Store a triage summary on an alert: what changed, over what period, why it might matter, and a suggested next step. Under 120 words, cite specific values and dates, wellness language only. "${DISCLAIMER}" is appended automatically.`,
    parameters: obj({ alert_id: { type: "integer" }, summary: { type: "string" } }, ["alert_id", "summary"]),
    label: (a) => `Saving triage summary for alert #${a.alert_id}`,
    run: (a, ctx) => {
      const alert = getAlert(ctx, a.alert_id);
      let summary = String(a.summary ?? "").trim();
      checkWellness(summary);
      if (!summary.includes(DISCLAIMER)) summary = `${summary} ${DISCLAIMER}`;
      if (wordCount(summary) > 120) throw new ToolError(`Rejected: ${wordCount(summary)} words; must be under 120 including the disclaimer.`);
      ctx.db.update(s.alerts).set({ summary }).where(eq(s.alerts.id, alert.id)).run();
      return { saved: true, alert_id: alert.id };
    },
  },

  save_status_line: {
    description: `Store the one-sentence "Is ${"{parent}"} okay?" status shown on Home (max 25 words), plus the alert ids and metrics it summarizes so the UI can link to the data.`,
    parameters: obj({
      text: { type: "string" },
      source_alert_ids: { type: "array", items: { type: "integer" } },
      source_metrics: { type: "array", items: { type: "string", enum: METRICS } },
    }, ["text", "source_alert_ids", "source_metrics"]),
    label: () => "Updating the status line",
    run: (a, ctx) => {
      const text = String(a.text ?? "").trim();
      checkWellness(text);
      if (wordCount(text) > 25) throw new ToolError(`Rejected: ${wordCount(text)} words; max 25.`);
      const ids = (Array.isArray(a.source_alert_ids) ? a.source_alert_ids : []).map((id) => getAlert(ctx, id).id);
      const metrics = (Array.isArray(a.source_metrics) ? a.source_metrics : []).map(metricArg);
      ctx.db.update(s.careProfiles).set({
        statusLine: { text, sourceAlertIds: ids, sourceMetrics: metrics, at: now().toISOString() },
      }).where(eq(s.careProfiles.id, ctx.profile.id)).run();
      return { saved: true };
    },
  },

  // ---------- fake Zocdoc ----------
  zocdoc_search_slots: {
    description: "Search Zocdoc for open appointment slots, by Zocdoc provider id or by specialty (searches every provider of that specialty). Read-only; also reports whether each provider accepts the parent's insurance. If a provider has nothing in the window, next_available shows their earliest slot.",
    parameters: obj({
      zocdoc_provider_id: { type: "string" },
      specialty: { type: "string" },
      days: { type: "integer", minimum: 1, maximum: 30 },
    }),
    label: (a) => `Searching Zocdoc${a.specialty ? ` for ${String(a.specialty).toLowerCase()}` : ""}`,
    run: (a, { profile }) => zocdocCall(() => {
      if (!a.zocdoc_provider_id && !a.specialty) throw new ToolError("give zocdoc_provider_id or specialty");
      const providers = a.zocdoc_provider_id ? [zocdoc.getProvider(String(a.zocdoc_provider_id))] : zocdoc.listProviders({ specialty: String(a.specialty) });
      if (!providers.length) throw new ToolError(`no providers found for specialty ${a.specialty}`);
      const days = Math.min(30, Math.max(1, int(a.days, 14)));
      return providers.map((p) => {
        const slots = zocdoc.searchSlots(p.id, now(), days);
        const next = slots.length ? undefined : zocdoc.searchSlots(p.id, now(), 60)[0];
        return {
          provider: { zocdoc_provider_id: p.id, name: p.name, specialty: p.specialty, address: p.address },
          in_network: p.accepts.includes(profile.insurancePlan),
          insurance_plan: profile.insurancePlan,
          window_days: days,
          slots: slots.slice(0, 8).map((x) => ({ slot_id: x.slotId, starts: fmtSlot(x.startAt, profile.timezone) })),
          ...(next ? { next_available: fmtSlot(next.startAt, profile.timezone) } : {}),
        };
      });
    }),
  },

  zocdoc_book_appointment: {
    description: "Book the Zocdoc slot in an APPROVED book_appointment approval. Refuses without a valid approved approval_id. Books exactly what was approved.",
    parameters: obj({ approval_id: { type: "integer" } }, ["approval_id"]),
    label: () => "Booking on Zocdoc",
    run: (a, ctx) => {
      const approval = requireApproved(ctx.db, ctx.profile.id, a.approval_id, "book_appointment");
      const payload = approval.payload as { slot_id: string; zocdoc_provider_id: string; alert_id: number | null };
      let booking;
      try {
        booking = zocdoc.book(payload.slot_id, { name: ctx.profile.parentName, insurancePlan: ctx.profile.insurancePlan }, now());
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        finishApproval(ctx.db, approval.id, "failed", { error: message });
        throw new ToolError(`Zocdoc: ${message}. Search again and ask for a new approval.`);
      }
      const zp = zocdoc.getProvider(booking.providerId);
      const provider = ctx.db.select().from(s.providers)
        .where(and(eq(s.providers.careProfileId, ctx.profile.id), eq(s.providers.zocdocProviderId, zp.id))).get()
        ?? ctx.db.insert(s.providers).values({ careProfileId: ctx.profile.id, name: zp.name, specialty: zp.specialty, zocdocProviderId: zp.id }).returning().get();
      const appt = ctx.db.insert(s.appointments).values({
        careProfileId: ctx.profile.id, providerId: provider.id, alertId: payload.alert_id, startAt: booking.startAt,
        zocdocConfirmation: booking.confirmation, status: "booked", location: zp.address, reason: approval.reason,
      }).returning().get();
      finishApproval(ctx.db, approval.id, "executed", { appointment_id: appt.id, confirmation: booking.confirmation });
      if (payload.alert_id) ctx.db.update(s.alerts).set({ status: "follow_up_booked" }).where(eq(s.alerts.id, payload.alert_id)).run();
      return {
        booked: true, appointment_id: appt.id, confirmation: booking.confirmation, starts: fmtSlot(booking.startAt, ctx.profile.timezone), provider: zp.name,
        next_steps: ["add_to_family_calendar", "notify_care_circle", "show_appointment_card"],
      };
    },
  },

  zocdoc_cancel_appointment: {
    description: "Cancel the appointment in an APPROVED cancel_appointment approval, free the Zocdoc slot, and remove it from the family calendar. Refuses without a valid approved approval_id.",
    parameters: obj({ approval_id: { type: "integer" } }, ["approval_id"]),
    label: () => "Cancelling on Zocdoc",
    run: (a, ctx) => {
      const approval = requireApproved(ctx.db, ctx.profile.id, a.approval_id, "cancel_appointment");
      const { appointment_id, confirmation } = approval.payload as { appointment_id: number; confirmation: string };
      zocdocCall(() => zocdoc.cancel(confirmation, now()));
      ctx.db.update(s.appointments).set({ status: "cancelled", calendarEventId: null }).where(eq(s.appointments.id, appointment_id)).run();
      familyCalendar.removeForAppointment(appointment_id);
      finishApproval(ctx.db, approval.id, "executed", { appointment_id, cancelled: confirmation });
      return { cancelled: true, appointment_id, confirmation };
    },
  },

  // ---------- approvals ----------
  request_approval: {
    description: `Ask the family to approve an external action. Shows an Approve / Decline card built from the action's real details, then STOP and wait: you'll get an [Automated event] when they decide. Actions: ${ACTION_TYPES.join(", ")}. book_appointment needs slot_id (from zocdoc_search_slots) and optionally alert_id; cancel_appointment needs appointment_id. reason is one short plain-language line.`,
    parameters: obj({
      action: { type: "string", enum: ACTION_TYPES },
      slot_id: { type: "string" },
      appointment_id: { type: "integer" },
      alert_id: { type: "integer" },
      reason: { type: "string" },
    }, ["action", "reason"]),
    label: (a) => `Asking for approval to ${String(a.action).replace("_", " ")}`,
    run: (a, ctx) => {
      const reason = String(a.reason ?? "").trim();
      checkWellness(reason);
      const approval = createApproval(ctx.db, ctx.profile, a.action as ActionType, a, reason);
      ctx.blocks.push({
        type: "approval", approvalId: approval.id, title: approval.summary.title, lines: approval.summary.lines,
        reason: approval.reason ?? undefined, status: approval.status, parentRequired: approval.parentRequired,
        parentName: ctx.profile.parentName, decisions: [],
      });
      return { approval_id: approval.id, status: "pending", note: "Wait for the family's decision. Do not call the action's tool yet." };
    },
  },

  // ---------- family coordination (inside the care circle; no approval needed) ----------
  add_to_family_calendar: {
    description: "Put a booked appointment on the shared family calendar (or update it). The whole care circle is invited.",
    parameters: obj({ appointment_id: { type: "integer" } }, ["appointment_id"]),
    label: () => "Adding to the family calendar",
    run: (a, ctx) => {
      const { a: appt, p } = getAppointment(ctx, a.appointment_id);
      if (appt.status !== "booked") throw new ToolError(`appointment ${appt.id} is ${appt.status}`);
      const circle = ctx.db.select({ name: s.users.name }).from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId)).where(eq(s.memberships.careProfileId, ctx.profile.id)).all();
      const minutes = zocdoc.getProvider(p.zocdocProviderId).visit_minutes;
      const event = familyCalendar.upsertForAppointment({
        appointmentId: appt.id,
        title: `${firstName(ctx.profile)}: ${p.specialty.toLowerCase()} visit with ${p.name}`,
        startAt: appt.startAt,
        endAt: new Date(Date.parse(appt.startAt) + minutes * 60_000).toISOString(),
        location: appt.location,
        attendees: circle.map((c) => c.name),
      }, now());
      ctx.db.update(s.appointments).set({ calendarEventId: event.id }).where(eq(s.appointments.id, appt.id)).run();
      return { added: true, event_id: event.id, attendees: event.attendees };
    },
  },

  notify_care_circle: {
    description: "Send a push notification to caregivers in the care circle (not the parent). Defaults to every caregiver except the person you're talking with. Use after something changes (booked, cancelled, needs a decision). Keep it to 1-2 sentences.",
    parameters: obj({ text: { type: "string" }, user_ids: { type: "array", items: { type: "integer" } } }, ["text"]),
    label: () => "Notifying the care circle",
    run: (a, ctx) => {
      const text = String(a.text ?? "").trim();
      if (!text) throw new ToolError("text is empty");
      checkWellness(text);
      const caregivers = ctx.db.select({ id: s.users.id, name: s.users.name, role: s.memberships.role }).from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId)).where(eq(s.memberships.careProfileId, ctx.profile.id)).all()
        .filter((m) => m.role !== "parent");
      const wanted = Array.isArray(a.user_ids) && a.user_ids.length ? new Set(a.user_ids.map(Number)) : null;
      const to = caregivers.filter((c) => (wanted ? wanted.has(c.id) : c.id !== ctx.actorId));
      if (!to.length) throw new ToolError("no caregivers to notify (only caregivers, not the parent, can be notified)");
      for (const c of to) messaging.send({ toUserId: c.id, toName: c.name, channel: "push", text }, now());
      return { sent_to: to.map((c) => c.name) };
    },
  },

  // ---------- render (UI blocks in the chat) ----------
  show_trend_chart: {
    description: "Render a 30-day-style trend chart for a daily metric in your reply. Optionally highlight specific reading ids (e.g. the readings behind an alert).",
    parameters: obj({
      metric: { type: "string", enum: DAILY_METRICS },
      days: { type: "integer", minimum: 3, maximum: 30 },
      highlight_reading_ids: { type: "array", items: { type: "integer" } },
      caption: { type: "string" },
    }, ["metric", "days"]),
    label: (a) => `Drawing a ${METRIC_INFO[a.metric as Metric]?.label.toLowerCase() ?? ""} chart`,
    run: (a, ctx) => {
      const metric = metricArg(a.metric);
      if (!DAILY_METRICS.includes(metric)) throw new ToolError("charts are only available for daily metrics");
      const caption = a.caption ? String(a.caption) : undefined;
      if (caption) checkWellness(caption);
      ctx.blocks.push({
        type: "trend", metric, label: METRIC_INFO[metric].label, unit: METRIC_INFO[metric].unit,
        points: series(ctx.db, ctx.profile.id, metric, Math.min(30, Math.max(3, int(a.days, 30)))),
        highlight: Array.isArray(a.highlight_reading_ids) ? a.highlight_reading_ids.map(Number) : [],
        caption,
      });
      return { shown: true };
    },
  },

  show_health_overview: {
    description: "Render every daily wearable chart (resting heart rate, HRV, sleep, steps) together, each against the parent's own baseline, with any open alert's readings and threshold marked on its chart. Use this for general check-ins like 'Is he okay this week?'. Returns the numbers so you can cite them.",
    parameters: obj({ caption: { type: "string" } }, []),
    label: () => "Drawing all of the health charts",
    run: (a, ctx) => {
      const caption = a.caption ? String(a.caption) : undefined;
      if (caption) checkWellness(caption);
      const vitals = getVitals(ctx.db, ctx.profile.id);
      if (!vitals.length) throw new ToolError("no readings synced yet");
      ctx.blocks.push({ type: "health_overview", parentName: ctx.profile.parentName, caption, vitals });
      return {
        shown: true,
        metrics: vitals.map((v) => ({
          metric: v.metric, latest: v.latest, baseline: Math.round(v.baseline * 10) / 10,
          change_vs_baseline_pct: Math.round(v.deltaPct),
          open_alert: v.alert ? { alert_id: v.alert.id, label: v.alert.label, evidence: v.alert.description } : null,
        })),
      };
    },
  },

  show_alert_card: {
    description: "Render an alert card (rule, chart of the evidence, and buttons). Urgent alerts automatically include emergency call buttons and never offer booking.",
    parameters: obj({ alert_id: { type: "integer" } }, ["alert_id"]),
    label: (a) => `Showing alert #${a.alert_id}`,
    run: (a, ctx) => {
      ctx.blocks.push(alertBlock(ctx.db, getAlert(ctx, a.alert_id), ctx.profile));
      return { shown: true };
    },
  },

  show_slot_picker: {
    description: "Render tappable appointment slots (usually 3) from zocdoc_search_slots. Tapping one sends you the caregiver's choice; then request approval for that slot.",
    parameters: obj({ slot_ids: { type: "array", items: { type: "string" }, maxItems: 6 }, note: { type: "string" } }, ["slot_ids"]),
    label: () => "Showing open times",
    run: (a, ctx) => zocdocCall(() => {
      const ids = (Array.isArray(a.slot_ids) ? a.slot_ids : []).map(String);
      if (!ids.length) throw new ToolError("slot_ids is empty");
      const options = ids.map((id) => {
        const p = zocdoc.getProvider(id.split("@")[0]);
        const slot = zocdoc.searchSlots(p.id, now(), 60).find((x) => x.slotId === id);
        if (!slot) throw new ToolError(`slot ${id} is not open`);
        return { slotId: id, providerName: p.name, specialty: p.specialty, startAt: slot.startAt, address: p.address };
      });
      ctx.blocks.push({ type: "slots", timeZone: ctx.profile.timezone, options, note: a.note ? String(a.note) : undefined });
      return { shown: options.length };
    }),
  },

  show_appointment_card: {
    description: "Render an appointment card (time, place, confirmation, calendar status).",
    parameters: obj({ appointment_id: { type: "integer" } }, ["appointment_id"]),
    label: () => "Showing the appointment",
    run: (a, ctx) => {
      ctx.blocks.push(appointmentBlock(ctx, int(a.appointment_id, -1)));
      return { shown: true };
    },
  },

  show_quick_replies: {
    description: "Render up to 4 tappable suggested replies under your message. Each option is sent back to you as the caregiver's message when tapped.",
    parameters: obj({ options: { type: "array", items: { type: "string" }, maxItems: 4 } }, ["options"]),
    label: () => "Suggesting next steps",
    run: (a, ctx) => {
      const options = (Array.isArray(a.options) ? a.options : []).map(String).filter(Boolean).slice(0, 4);
      ctx.blocks.push({ type: "quick_replies", options });
      return { shown: true };
    },
  },
};

export const TOOL_DEFS: ToolDef[] = Object.entries(TOOLS).map(([name, t]) => ({
  type: "function",
  function: { name, description: t.description, parameters: t.parameters },
}));

export function toolLabel(name: string, args: Record<string, unknown>) {
  try {
    return TOOLS[name]?.label(args) ?? name;
  } catch {
    return name;
  }
}

export { firstName };
