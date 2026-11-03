import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { DAILY_METRICS, METRIC_INFO, type Metric } from "@/fakes/wearables";
import { messaging } from "@/fakes/messaging";
import { RULES, type Evidence, type RuleId, type Severity } from "@/rules/alerts";
import { DAY_MS, fmtLocalDay, fmtSlot, localDay, now } from "./clock";
import type { VitalSummary } from "./blocks";
import { series } from "./thread";

// Everything the Overview page shows, gathered in one place so the page only renders.
// Types here are plain data: they cross into client components (calendar, feed, charts).

type Profile = typeof s.careProfiles.$inferSelect;

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  cta: string;
}

export type UpdateKind = "health" | "action" | "family";
export type UpdateIcon = "alert" | "approval" | "done" | "failed" | "appointment" | "message" | "visit" | "pill" | "chat";

export interface UpdateItem {
  id: string;
  kind: UpdateKind;
  icon: UpdateIcon;
  at: string;
  when: string;
  actor: string;
  title: string;
  detail?: string;
  severity?: Severity;
}

export type CalendarKind = "appointment" | "refill" | "alert" | "action";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  day: string; // YYYY-MM-DD in the parent's time zone
  time?: string;
  title: string;
  detail?: string;
}


export interface Stats {
  openAlerts: number;
  topSeverity: Severity | null;
  pendingApprovals: number;
  nextVisit: { provider: string; when: string } | null;
  nextRefill: { name: string; daysLeft: number; pct: number } | null;
}

const RANK: Record<Severity, number> = { urgent: 0, follow_up: 1, watch: 2, info: 3 };
const FEED_DAYS = 14;
const FEED_LIMIT = 20;
const STALE_SYNC_MS = 2 * DAY_MS;
const PREP_WINDOW_MS = 3 * DAY_MS;

export function getOverview(db: Db, profile: Profile) {
  const tz = profile.timezone;
  const t = now();
  const today = localDay(t, tz).date;
  const fmtDay = (iso: string) => fmtLocalDay(iso, tz);
  const dayOf = (iso: string) => localDay(new Date(iso), tz).date;
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const feedSince = new Date(t.getTime() - FEED_DAYS * DAY_MS).toISOString();

  const names = new Map(db.select().from(s.users).all().map((u) => [u.id, u.name]));
  const first = profile.parentName.split(" ")[0];

  const alerts = db.select().from(s.alerts).where(eq(s.alerts.careProfileId, profile.id))
    .orderBy(desc(s.alerts.createdAt)).all();
  const openAlerts = alerts.filter((a) => a.status === "open");

  const approvals = db.select().from(s.approvals).where(eq(s.approvals.careProfileId, profile.id))
    .orderBy(desc(s.approvals.requestedAt)).all();

  const appointments = db.select({ a: s.appointments, provider: s.providers.name }).from(s.appointments)
    .innerJoin(s.providers, eq(s.providers.id, s.appointments.providerId))
    .where(eq(s.appointments.careProfileId, profile.id))
    .orderBy(asc(s.appointments.startAt)).all();
  const upcoming = appointments.filter(({ a }) => a.status === "booked" && new Date(a.startAt) >= t);

  const meds = db.select().from(s.medications)
    .where(and(eq(s.medications.careProfileId, profile.id), eq(s.medications.active, true))).all()
    .map((m) => {
      const runsOut = new Date(new Date(m.lastFillAt).getTime() + m.daysSupply * DAY_MS);
      return { ...m, runsOut, daysLeft: Math.ceil((runsOut.getTime() - t.getTime()) / DAY_MS) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const refillRequests = meds.length
    ? db.select().from(s.refills).where(inArray(s.refills.medicationId, meds.map((m) => m.id))).all() : [];

  const apptIds = appointments.map(({ a }) => a.id);
  const briefs = apptIds.length
    ? db.select().from(s.previsitBriefs).where(inArray(s.previsitBriefs.appointmentId, apptIds)).all() : [];
  const visitSummaries = apptIds.length
    ? db.select().from(s.visitSummaries).where(inArray(s.visitSummaries.appointmentId, apptIds)).all() : [];
  const pendingMedChanges = visitSummaries.length
    ? db.select().from(s.medChangeProposals).where(and(
      inArray(s.medChangeProposals.visitSummaryId, visitSummaries.map((v) => v.id)),
      eq(s.medChangeProposals.status, "pending"),
    )).all() : [];

  const lastReading = db.select().from(s.readings).where(eq(s.readings.careProfileId, profile.id))
    .orderBy(desc(s.readings.recordedAt)).limit(1).get();

  // ---- Issues: things a family member should look at, worst first. ----
  const issues: Issue[] = [];

  // Urgent alerts already get the emergency banner, so they aren't repeated here.
  for (const a of openAlerts.filter((a) => a.severity !== "urgent")) {
    issues.push({
      id: `alert-${a.id}`, severity: a.severity, title: RULES[a.ruleId as RuleId].label,
      detail: a.summary ?? `Flagged ${fmtDay(a.createdAt)}.`, cta: "Talk it through",
    });
  }
  for (const a of approvals.filter((a) => a.status === "pending")) {
    const decided = a.decisions.map((d) => d.name.split(" ")[0]);
    issues.push({
      id: `approval-${a.id}`, severity: "follow_up", title: `Waiting for approval: ${a.summary.title}`,
      detail: decided.length ? `${decided.join(", ")} approved. Still needs ${first}'s OK.` : a.summary.lines[0] ?? "",
      cta: "Review",
    });
  }
  for (const a of approvals.filter((a) => a.status === "failed" && (a.executedAt ?? "") >= feedSince)) {
    issues.push({
      id: `failed-${a.id}`, severity: "follow_up", title: `Didn't go through: ${a.summary.title}`,
      detail: "CareAgent tried this after it was approved, but it failed. Ask it to try again.", cta: "Retry in chat",
    });
  }
  for (const m of meds) {
    const requested = refillRequests.some((r) => r.medicationId === m.id && r.requestedAt >= m.lastFillAt);
    if (requested) continue;
    if (m.daysLeft <= 0) {
      issues.push({ id: `med-${m.id}`, severity: "follow_up", title: `${m.name} has run out`, detail: `The last fill covered ${m.daysSupply} days and ended ${fmtDay(m.runsOut.toISOString())}.`, cta: "Request refill" });
    } else if (m.daysLeft <= 7) {
      issues.push({ id: `med-${m.id}`, severity: "watch", title: `${m.name} refill due`, detail: `${m.daysLeft} days left, runs out ${fmtDay(m.runsOut.toISOString())}. No refill requested yet.`, cta: "Request refill" });
    }
  }
  if (!lastReading || t.getTime() - new Date(lastReading.recordedAt).getTime() > STALE_SYNC_MS) {
    issues.push({
      id: "sync", severity: "watch", title: `${first}'s watch isn't syncing`,
      detail: lastReading ? `No new readings since ${fmtDay(lastReading.recordedAt)}. Alerts can't fire without fresh data.` : "No readings yet. Alerts can't fire without data.",
      cta: "Check sync",
    });
  }
  for (const { a, provider } of upcoming) {
    if (!a.calendarEventId) {
      issues.push({ id: `cal-${a.id}`, severity: "info", title: `Not on the family calendar: ${provider}`, detail: `${fmtSlot(a.startAt, tz)}. The rest of the family may not know about it.`, cta: "Add to calendar" });
    }
    const brief = briefs.find((b) => b.appointmentId === a.id);
    if (new Date(a.startAt).getTime() - t.getTime() <= PREP_WINDOW_MS && (!brief || brief.status === "draft")) {
      issues.push({ id: `brief-${a.id}`, severity: "info", title: `Prep for ${provider}`, detail: `Visit is ${fmtSlot(a.startAt, tz)}. ${brief ? "The pre-visit brief is still a draft." : "No pre-visit brief yet."}`, cta: "Prepare brief" });
    }
  }
  if (pendingMedChanges.length) {
    issues.push({ id: "med-changes", severity: "follow_up", title: "Medication changes to confirm", detail: `${pendingMedChanges.length} change${pendingMedChanges.length > 1 ? "s" : ""} from a visit summary need a family member to confirm.`, cta: "Review" });
  }
  issues.sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  // ---- Latest updates: one feed across alerts, actions, visits and family messages. ----
  const updates: UpdateItem[] = [];
  const when = (iso: string) => fmtSlot(iso, tz);
  const watchName = `${first}'s watch`;

  for (const a of alerts) {
    updates.push({
      id: `alert-${a.id}`, kind: "health", icon: "alert", at: a.createdAt, when: when(a.createdAt), actor: watchName,
      title: RULES[a.ruleId as RuleId].label, detail: a.summary ?? undefined, severity: a.severity,
    });
  }
  for (const a of approvals) {
    updates.push({
      id: `req-${a.id}`, kind: "action", icon: "approval", at: a.requestedAt, when: when(a.requestedAt), actor: "CareAgent",
      title: `Asked to ${a.summary.title.charAt(0).toLowerCase()}${a.summary.title.slice(1)}`, detail: a.reason ?? a.summary.lines[0],
    });
    for (const [i, d] of a.decisions.entries()) {
      updates.push({
        id: `dec-${a.id}-${i}`, kind: "family", icon: d.decision === "approve" ? "done" : "failed", at: d.at, when: when(d.at), actor: d.name,
        title: `${d.decision === "approve" ? "Approved" : "Declined"}: ${a.summary.title}`,
      });
    }
    if (a.executedAt && (a.status === "executed" || a.status === "failed")) {
      updates.push({
        id: `exec-${a.id}`, kind: "action", icon: a.status === "executed" ? "done" : "failed", at: a.executedAt, when: when(a.executedAt), actor: "CareAgent",
        title: `${a.status === "executed" ? "Done" : "Failed"}: ${a.summary.title}`, detail: a.summary.lines.slice(0, 2).join(" · "),
      });
    }
  }
  for (const v of visitSummaries) {
    updates.push({ id: `visit-${v.id}`, kind: "health", icon: "visit", at: v.createdAt, when: when(v.createdAt), actor: "CareAgent", title: "Visit summary added", detail: v.text.slice(0, 160) });
  }
  for (const r of refillRequests) {
    const med = meds.find((m) => m.id === r.medicationId);
    updates.push({ id: `refill-${r.id}`, kind: "action", icon: "pill", at: r.updatedAt, when: when(r.updatedAt), actor: "CareAgent", title: `${med?.name ?? "Refill"}: ${r.status.replace(/_/g, " ")}` });
  }
  for (const m of messaging.all()) {
    updates.push({ id: m.id, kind: "family", icon: "message", at: m.sentAt, when: when(m.sentAt), actor: "CareAgent", title: `Notified ${m.toName.split(" ")[0]}`, detail: m.text });
  }
  const familyChat = db.select().from(s.chatMessages)
    .where(and(eq(s.chatMessages.careProfileId, profile.id), eq(s.chatMessages.role, "user")))
    .orderBy(desc(s.chatMessages.id)).limit(10).all();
  for (const c of familyChat) {
    updates.push({
      id: `chat-${c.id}`, kind: "family", icon: "chat", at: c.createdAt, when: when(c.createdAt),
      actor: (c.authorId && names.get(c.authorId)) || "Family", title: "Asked CareAgent", detail: c.content.slice(0, 160),
    });
  }
  const feed = updates.filter((u) => u.at >= feedSince).sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);

  // ---- Calendar: what happened or is due, by day in the parent's time zone. ----
  const calendar: CalendarItem[] = [];
  for (const { a, provider } of appointments.filter(({ a }) => a.status === "booked")) {
    calendar.push({ id: `appt-${a.id}`, kind: "appointment", day: dayOf(a.startAt), time: timeOf(a.startAt), title: provider, detail: [a.reason, a.location].filter(Boolean).join(" · ") || undefined });
  }
  for (const m of meds) {
    calendar.push({ id: `runout-${m.id}`, kind: "refill", day: dayOf(m.runsOut.toISOString()), title: `${m.name} runs out`, detail: `${m.dose}, ${m.frequency}` });
  }
  for (const a of alerts) {
    calendar.push({ id: `alert-${a.id}`, kind: "alert", day: dayOf(a.createdAt), time: timeOf(a.createdAt), title: RULES[a.ruleId as RuleId].label, detail: a.status === "open" ? "Open" : "Resolved" });
  }
  for (const a of approvals.filter((a) => a.status === "executed" && a.executedAt)) {
    calendar.push({ id: `done-${a.id}`, kind: "action", day: dayOf(a.executedAt!), time: timeOf(a.executedAt!), title: a.summary.title, detail: "Done by CareAgent" });
  }

  const vitals = getVitals(db, profile.id);

  const next = upcoming[0];
  const stats: Stats = {
    openAlerts: openAlerts.length,
    topSeverity: openAlerts.map((a) => a.severity).sort((a, b) => RANK[a] - RANK[b])[0] ?? null,
    pendingApprovals: approvals.filter((a) => a.status === "pending").length,
    nextVisit: next ? { provider: next.provider, when: fmtSlot(next.a.startAt, tz) } : null,
    nextRefill: meds[0] ? { name: meds[0].name, daysLeft: meds[0].daysLeft, pct: Math.max(0, Math.min(100, (meds[0].daysLeft / meds[0].daysSupply) * 100)) } : null,
  };

  return {
    today,
    stats,
    issues,
    feed,
    calendar,
    vitals,
    lastSync: lastReading?.recordedAt ?? null,
    hasUrgent: openAlerts.some((a) => a.severity === "urgent"),
  };
}

// Last 30 days per daily metric, compared with the parent's own baseline (the days before the
// most recent week). Charts for metrics behind an open alert are flagged.
export function getVitals(db: Db, careProfileId: number, days = 30): VitalSummary[] {
  const open = db.select().from(s.alerts)
    .where(and(eq(s.alerts.careProfileId, careProfileId), eq(s.alerts.status, "open")))
    .orderBy(desc(s.alerts.createdAt)).all();
  return DAILY_METRICS.map((metric): VitalSummary => {
    const points = series(db, careProfileId, metric, days);
    const values = points.map((p) => p.value);
    const alert = open.find((a) => RULE_METRIC[a.ruleId as RuleId] === metric);
    const ev = alert?.evidence as Evidence | undefined;
    // Use the alert's own baseline when there is one, so the chart matches what the alert says.
    const baseline = ev?.baseline?.value ?? avg(values.slice(0, Math.max(1, values.length - 7)));
    return {
      metric, label: METRIC_INFO[metric].label, unit: METRIC_INFO[metric].unit, points,
      latest: values.at(-1) ?? 0,
      baseline,
      deltaPct: baseline ? ((avg(values.slice(-3)) - baseline) / baseline) * 100 : 0,
      flagged: !!alert,
      alert: alert && ev ? {
        id: alert.id, label: RULES[alert.ruleId as RuleId].label, description: ev.description,
        highlight: ev.readings.map((r) => r.id), threshold: ev.threshold,
      } : undefined,
    };
  }).filter((v) => v.points.length > 1);
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// Which chart to highlight when a rule's alert is open.
const RULE_METRIC: Partial<Record<RuleId, Metric>> = { resting_hr_elevated: "resting_hr", sleep_short: "sleep_hours" };

export type Overview = ReturnType<typeof getOverview>;
