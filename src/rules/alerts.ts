import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { fmtDay, now } from "@/lib/clock";

// Rule-based alert engine. Rules describe changes in readings; they never diagnose.

export type Severity = "info" | "watch" | "follow_up" | "urgent";
export type RuleId = "resting_hr_elevated" | "sleep_short" | "fall_detected" | "fall_no_movement" | "irregular_rhythm";
type Reading = typeof s.readings.$inferSelect;
export type Alert = typeof s.alerts.$inferSelect;

export const RULES: Record<RuleId, { label: string; severity: Severity }> = {
  resting_hr_elevated: { label: "Resting heart rate higher than usual", severity: "follow_up" },
  sleep_short: { label: "Several short nights of sleep", severity: "watch" },
  fall_detected: { label: "Fall detected by watch", severity: "follow_up" },
  fall_no_movement: { label: "Fall detected with no movement afterward", severity: "urgent" },
  irregular_rhythm: { label: "Irregular rhythm notification from watch", severity: "follow_up" },
};

export const DEFAULT_RULE_CONFIG = {
  restingHrPctAbove: 0.15, // fire when resting HR is this far above baseline...
  restingHrMinDays: 3, // ...for this many consecutive recent days
  baselineDays: 14,
  recentWindowDays: 5,
  sleepMinHours: 4,
  sleepMinNights: 3,
};
export type RuleConfig = typeof DEFAULT_RULE_CONFIG;

export interface EvidenceReading {
  id: number;
  metric: string;
  value: number;
  recordedAt: string;
}

export interface Evidence {
  // Trend rules use the rule id (one open alert at a time); event rules use rule:readingId.
  dedupKey: string;
  description: string;
  readings: EvidenceReading[];
  baseline?: { value: number; from: string; to: string };
  threshold?: number;
}

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  evidence: Evidence;
}

const toEvidence = (r: Reading): EvidenceReading => ({ id: r.id, metric: r.metric, value: r.value, recordedAt: r.recordedAt });
const byMetric = (rs: Reading[], metric: string) =>
  rs.filter((r) => r.metric === metric).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

function restingHrRule(rs: Reading[], cfg: RuleConfig): Finding[] {
  const series = byMetric(rs, "resting_hr");
  if (series.length < cfg.baselineDays + cfg.recentWindowDays) return [];
  const recent = series.slice(-cfg.recentWindowDays);
  const base = series.slice(-(cfg.baselineDays + cfg.recentWindowDays), -cfg.recentWindowDays);
  const baseline = base.reduce((sum, r) => sum + r.value, 0) / base.length;
  const threshold = baseline * (1 + cfg.restingHrPctAbove);

  const elevated: Reading[] = [];
  for (let i = recent.length - 1; i >= 0 && recent[i].value >= threshold; i--) elevated.unshift(recent[i]);
  if (elevated.length < cfg.restingHrMinDays) return [];

  const b = Number(baseline.toFixed(1));
  const pct = Math.round(cfg.restingHrPctAbove * 100);
  return [{
    ruleId: "resting_hr_elevated",
    severity: RULES.resting_hr_elevated.severity,
    evidence: {
      dedupKey: "resting_hr_elevated",
      description: `Resting heart rate was ${pct}% or more above its ${cfg.baselineDays}-day average of ${b} bpm for ${elevated.length} days in a row (${elevated.map((r) => `${r.value} bpm on ${fmtDay(r.recordedAt)}`).join(", ")}).`,
      readings: elevated.map(toEvidence),
      baseline: { value: b, from: base[0].recordedAt, to: base[base.length - 1].recordedAt },
      threshold: Number(threshold.toFixed(1)),
    },
  }];
}

function sleepRule(rs: Reading[], cfg: RuleConfig): Finding[] {
  const last = byMetric(rs, "sleep_hours").slice(-cfg.sleepMinNights);
  if (last.length < cfg.sleepMinNights || last.some((r) => r.value >= cfg.sleepMinHours)) return [];
  return [{
    ruleId: "sleep_short",
    severity: RULES.sleep_short.severity,
    evidence: {
      dedupKey: "sleep_short",
      description: `Sleep was under ${cfg.sleepMinHours} hours for ${last.length} nights in a row (${last.map((r) => `${r.value} h on ${fmtDay(r.recordedAt)}`).join(", ")}).`,
      readings: last.map(toEvidence),
      threshold: cfg.sleepMinHours,
    },
  }];
}

function eventRules(rs: Reading[]): Finding[] {
  const out: Finding[] = [];
  for (const r of rs) {
    let ruleId: RuleId | null = null;
    let description = "";
    if (r.metric === "fall" && r.value === 2) {
      ruleId = "fall_no_movement";
      description = `The watch detected a fall on ${fmtDay(r.recordedAt)} and no movement afterward.`;
    } else if (r.metric === "fall") {
      ruleId = "fall_detected";
      description = `The watch detected a fall on ${fmtDay(r.recordedAt)}; movement was recorded afterward.`;
    } else if (r.metric === "irregular_rhythm") {
      ruleId = "irregular_rhythm";
      description = `The watch sent an irregular rhythm notification on ${fmtDay(r.recordedAt)}.`;
    }
    if (ruleId) {
      out.push({
        ruleId,
        severity: RULES[ruleId].severity,
        evidence: { dedupKey: `${ruleId}:${r.id}`, description, readings: [toEvidence(r)] },
      });
    }
  }
  return out;
}

export function evaluateRules(readings: Reading[], cfg: RuleConfig = DEFAULT_RULE_CONFIG): Finding[] {
  return [...eventRules(readings), ...restingHrRule(readings, cfg), ...sleepRule(readings, cfg)];
}

// Evaluates rules for one parent and stores any new alerts. Returns the alerts it created.
export function runAlertEngine(db: Db, careProfileId: number): Alert[] {
  const profile = db.select().from(s.careProfiles).where(eq(s.careProfiles.id, careProfileId)).get();
  if (!profile) throw new Error(`care profile ${careProfileId} not found`);
  const cfg = { ...DEFAULT_RULE_CONFIG, ...(profile.alertConfig ?? {}) };

  const readings = db.select().from(s.readings)
    .where(eq(s.readings.careProfileId, careProfileId)).orderBy(asc(s.readings.recordedAt)).all();
  const existing = db.select().from(s.alerts).where(eq(s.alerts.careProfileId, careProfileId)).all();
  // Events alert once ever; trends alert again only after the previous alert is resolved.
  const taken = new Set(
    existing
      .filter((a) => a.status !== "resolved" || (a.evidence as Evidence).dedupKey.includes(":"))
      .map((a) => (a.evidence as Evidence).dedupKey),
  );

  const created: Alert[] = [];
  for (const f of evaluateRules(readings, cfg)) {
    if (taken.has(f.evidence.dedupKey)) continue;
    created.push(db.insert(s.alerts).values({
      careProfileId,
      ruleId: f.ruleId,
      severity: f.severity,
      status: "open",
      evidence: f.evidence,
      createdAt: now().toISOString(),
    }).returning().get());
  }
  return created;
}

export function resolveAlert(db: Db, alertId: number) {
  db.update(s.alerts).set({ status: "resolved" }).where(and(eq(s.alerts.id, alertId))).run();
}
