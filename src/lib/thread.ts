import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { DAILY_METRICS, METRIC_INFO, type Metric } from "@/fakes/wearables";
import { RULES, type Alert, type Evidence, type RuleId } from "@/rules/alerts";
import type { Block, ChartPoint, SerializedMessage } from "./blocks";
import { now } from "./clock";

export type ChatMessage = typeof s.chatMessages.$inferSelect;
type Profile = typeof s.careProfiles.$inferSelect;

export function postMessage(db: Db, msg: Omit<typeof s.chatMessages.$inferInsert, "createdAt">) {
  return db.insert(s.chatMessages).values({ ...msg, createdAt: now().toISOString() }).returning().get();
}

export function getThread(db: Db, careProfileId: number, limit?: number): ChatMessage[] {
  const all = db.select().from(s.chatMessages)
    .where(eq(s.chatMessages.careProfileId, careProfileId)).orderBy(asc(s.chatMessages.id)).all();
  return limit ? all.slice(-limit) : all;
}

export function series(db: Db, careProfileId: number, metric: Metric, days = 30): ChartPoint[] {
  if (!DAILY_METRICS.includes(metric)) return [];
  return db.select().from(s.readings)
    .where(and(eq(s.readings.careProfileId, careProfileId), eq(s.readings.metric, metric)))
    .orderBy(asc(s.readings.recordedAt)).all()
    .slice(-days)
    .map((r) => ({ id: r.id, value: r.value, date: r.recordedAt }));
}

export function alertBlock(db: Db, alert: Alert, profile: Profile): Block {
  const ev = alert.evidence as Evidence;
  const metric = ev.readings[0]?.metric as Metric;
  const points = series(db, profile.id, metric);
  return {
    type: "alert",
    alertId: alert.id,
    severity: alert.severity,
    label: RULES[alert.ruleId as RuleId].label,
    description: ev.description,
    status: alert.status,
    metricLabel: METRIC_INFO[metric].label,
    unit: METRIC_INFO[metric].unit,
    points,
    highlight: ev.readings.map((r) => r.id),
    threshold: ev.threshold,
    eventAt: points.length ? undefined : ev.readings[0]?.recordedAt,
    parentName: profile.parentName,
    parentPhone: profile.parentPhone,
  };
}

// Blocks are snapshots; refresh live state (alert, approval, appointment status) so old cards stay accurate.
export function serializeThread(db: Db, messages: ChatMessage[]): SerializedMessage[] {
  const ids = (type: Block["type"], key: string) =>
    messages.flatMap((m) => m.blocks.flatMap((b) => (b.type === type ? [(b as Record<string, unknown>)[key] as number] : [])));
  const alertIds = ids("alert", "alertId"), approvalIds = ids("approval", "approvalId"), apptIds = ids("appointment", "appointmentId");
  const live: LiveState = {
    alerts: new Map((alertIds.length ? db.select().from(s.alerts).where(inArray(s.alerts.id, alertIds)).all() : []).map((a) => [a.id, a.status])),
    approvals: new Map((approvalIds.length ? db.select().from(s.approvals).where(inArray(s.approvals.id, approvalIds)).all() : []).map((a) => [a.id, a])),
    appointments: new Map((apptIds.length ? db.select().from(s.appointments).where(inArray(s.appointments.id, apptIds)).all() : []).map((a) => [a.id, a])),
  };
  const authorIds = [...new Set(messages.flatMap((m) => (m.authorId ? [m.authorId] : [])))];
  const names = new Map(
    (authorIds.length ? db.select().from(s.users).where(inArray(s.users.id, authorIds)).all() : []).map((u) => [u.id, u.name]),
  );
  return messages.map((m) => serializeMessage(m, names.get(m.authorId ?? -1), live));
}

interface LiveState {
  alerts: Map<number, string>;
  approvals: Map<number, typeof s.approvals.$inferSelect>;
  appointments: Map<number, typeof s.appointments.$inferSelect>;
}

function refresh(b: Block, live?: LiveState): Block {
  if (!live) return b;
  if (b.type === "alert" && live.alerts.has(b.alertId)) return { ...b, status: live.alerts.get(b.alertId)! };
  if (b.type === "approval" && live.approvals.has(b.approvalId)) {
    const a = live.approvals.get(b.approvalId)!;
    return { ...b, status: a.status, decisions: a.decisions.map((d) => ({ name: d.name, role: d.role, decision: d.decision })) };
  }
  if (b.type === "appointment" && live.appointments.has(b.appointmentId)) {
    const a = live.appointments.get(b.appointmentId)!;
    return { ...b, status: a.status, onCalendar: Boolean(a.calendarEventId) };
  }
  return b;
}

export function serializeMessage(m: ChatMessage, authorName?: string, live?: LiveState): SerializedMessage {
  return {
    id: m.id,
    role: m.role,
    authorName,
    content: m.content,
    blocks: m.blocks.map((b) => refresh(b, live)),
    trace: m.trace ?? null,
    createdAt: m.createdAt,
  };
}
