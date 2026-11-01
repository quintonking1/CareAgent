import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Bell, CalendarCheck, CalendarDays, ClipboardCheck, MessageSquare, Pill } from "lucide-react";
import { getDb, schema } from "@/db";
import { METRIC_INFO, type Metric } from "@/fakes/wearables";
import { messaging } from "@/fakes/messaging";
import { DAY_MS, fmtDay, fmtSlot, now } from "@/lib/clock";
import { getViewer } from "@/lib/viewer";
import { getCurrentProfile } from "@/lib/profile";
import { series } from "@/lib/thread";
import { RULES, type RuleId } from "@/rules/alerts";
import { EmergencyPrompt } from "@/components/emergency-prompt";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusSources } from "@/components/status-sources";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomePage() {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer } = await getViewer(db, profile.id);
  const inbox = messaging.inbox(viewer.id).slice(0, 5);
  const pendingApprovals = db.select().from(schema.approvals)
    .where(and(eq(schema.approvals.careProfileId, profile.id), eq(schema.approvals.status, "pending"))).all();
  const first = profile.parentName.split(" ")[0];
  const status = profile.statusLine;

  const openAlerts = db.select().from(schema.alerts)
    .where(and(eq(schema.alerts.careProfileId, profile.id), eq(schema.alerts.status, "open"))).all();
  const sourceAlerts = status?.sourceAlertIds.length
    ? db.select().from(schema.alerts).where(inArray(schema.alerts.id, status.sourceAlertIds)).all() : [];
  const appointments = db.select({ a: schema.appointments, provider: schema.providers.name }).from(schema.appointments)
    .innerJoin(schema.providers, eq(schema.providers.id, schema.appointments.providerId))
    .where(and(eq(schema.appointments.careProfileId, profile.id), eq(schema.appointments.status, "booked")))
    .orderBy(asc(schema.appointments.startAt)).all();
  const meds = db.select().from(schema.medications)
    .where(and(eq(schema.medications.careProfileId, profile.id), eq(schema.medications.active, true))).all()
    .map((m) => {
      const runsOut = new Date(new Date(m.lastFillAt).getTime() + m.daysSupply * DAY_MS);
      return { ...m, runsOut, daysLeft: Math.ceil((runsOut.getTime() - now().getTime()) / DAY_MS) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Overview" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 pt-2 sm:px-6">
          <section className="py-2">
            <p className="text-sm text-muted-foreground">Is {first} okay?</p>
            {status ? (
              <>
                <p className="mt-1 text-xl font-medium leading-snug">{status.text}</p>
                <div className="mt-3">
                  <StatusSources
                    alerts={sourceAlerts.map((a) => ({ id: a.id, label: RULES[a.ruleId as RuleId].label }))}
                    metrics={status.sourceMetrics.map((m) => ({
                      metric: m, label: METRIC_INFO[m as Metric].label, unit: METRIC_INFO[m as Metric].unit,
                      points: series(db, profile.id, m as Metric),
                    }))}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Written by CareAgent · {fmtDay(status.at)}</p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">CareAgent hasn&apos;t written a status yet. It updates after alerts and the daily review.</p>
            )}
          </section>

          {openAlerts.some((a) => a.severity === "urgent") && (
            <EmergencyPrompt parentName={profile.parentName} parentPhone={profile.parentPhone} />
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Needs attention</CardTitle>
              <Button asChild variant="ghost" size="sm" className="rounded-full"><Link href="/"><MessageSquare /> Open chat</Link></Button>
            </CardHeader>
            <CardContent>
              {openAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing right now.</p>
              ) : (
                <ul className="divide-y">
                  {openAlerts.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={a.severity} />
                        <span className="flex-1 text-sm font-medium">{RULES[a.ruleId as RuleId].label}</span>
                        <span className="text-xs text-muted-foreground">{fmtDay(a.createdAt)}</span>
                      </div>
                      {a.summary && <p className="mt-1.5 text-sm text-muted-foreground">{a.summary}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {pendingApprovals.length > 0 && (
            <Card className="border-foreground/60">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="size-4" /> Waiting for approval</CardTitle>
                <Button asChild size="sm" className="rounded-full"><Link href="/">Review in chat</Link></Button>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {pendingApprovals.map((a) => (
                    <li key={a.id} className="py-2 first:pt-0 last:pb-0 text-sm">
                      <p className="font-medium">{a.summary.title}</p>
                      <p className="text-muted-foreground">{a.summary.lines[0]}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {inbox.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" /> Your notifications</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {inbox.map((m) => (
                    <li key={m.id} className="py-2 first:pt-0 last:pb-0 text-sm">
                      <p>{m.text}</p>
                      <p className="text-xs text-muted-foreground">{fmtSlot(m.sentAt, profile.timezone)}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" /> Upcoming appointments</CardTitle></CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">None booked.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {appointments.map(({ a, provider }) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium">{provider}</p>
                        <p className="text-muted-foreground">{fmtSlot(a.startAt, profile.timezone)}</p>
                      </div>
                      {a.calendarEventId && <Badge variant="secondary" className="rounded-full"><CalendarCheck /> Family calendar</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Pill className="size-4" /> Medications & refills</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {meds.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{m.name} {m.dose}</p>
                      <p className="text-xs text-muted-foreground">{m.frequency}</p>
                    </div>
                    <span className={`text-xs ${m.daysLeft <= 7 ? "font-medium text-amber-600" : "text-muted-foreground"}`}>
                      {m.daysLeft <= 0 ? "Out of supply" : `${m.daysLeft} days left · ${fmtDay(m.runsOut.toISOString())}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
