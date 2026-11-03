import { inArray } from "drizzle-orm";
import { Activity, Pill } from "lucide-react";
import { getDb, schema } from "@/db";
import { METRIC_INFO, type Metric } from "@/fakes/wearables";
import { DAY_MS, fmtLocalDay, now } from "@/lib/clock";
import { getOverview } from "@/lib/overview";
import { getCurrentProfile } from "@/lib/profile";
import { series } from "@/lib/thread";
import { RULES, type RuleId } from "@/rules/alerts";
import { EmergencyPrompt } from "@/components/emergency-prompt";
import { IssuesPanel } from "@/components/overview/issues-panel";
import { OverviewCalendar } from "@/components/overview/overview-calendar";
import { StatCards } from "@/components/overview/stat-cards";
import { UpdatesFeed } from "@/components/overview/updates-feed";
import { StatusSources } from "@/components/status-sources";
import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VitalsGrid } from "@/components/vitals-grid";

export default async function HomePage() {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const o = getOverview(db, profile);
  const first = profile.parentName.split(" ")[0];
  const status = profile.statusLine;
  const sourceAlerts = status?.sourceAlertIds.length
    ? db.select().from(schema.alerts).where(inArray(schema.alerts.id, status.sourceAlertIds)).all() : [];

  const meds = db.select().from(schema.medications).all()
    .filter((m) => m.careProfileId === profile.id && m.active)
    .map((m) => {
      const runsOut = new Date(new Date(m.lastFillAt).getTime() + m.daysSupply * DAY_MS);
      return { ...m, runsOut, daysLeft: Math.ceil((runsOut.getTime() - now().getTime()) / DAY_MS) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Overview" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-8 pt-2 sm:px-6">
          <section className="py-2">
            <p className="text-sm text-muted-foreground">Is {first} okay?</p>
            {status ? (
              <>
                <p className="mt-1 max-w-3xl text-balance font-heading text-2xl leading-snug">{status.text}</p>
                <div className="mt-3">
                  <StatusSources
                    alerts={sourceAlerts.map((a) => ({ id: a.id, label: RULES[a.ruleId as RuleId].label }))}
                    metrics={status.sourceMetrics.map((m) => ({
                      metric: m, label: METRIC_INFO[m as Metric].label, unit: METRIC_INFO[m as Metric].unit,
                      points: series(db, profile.id, m as Metric),
                    }))}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Written by CareAgent · {fmtLocalDay(status.at, profile.timezone)}</p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">CareAgent hasn&apos;t written a status yet. It updates after alerts and the daily review.</p>
            )}
          </section>

          {o.hasUrgent && <EmergencyPrompt parentName={profile.parentName} parentPhone={profile.parentPhone} />}

          <StatCards stats={o.stats} />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <IssuesPanel issues={o.issues} hasUrgent={o.hasUrgent} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" /> How {first}&apos;s been</CardTitle>
                  <CardDescription>
                    From {first}&apos;s watch, compared with {first}&apos;s own usual.
                    {o.lastSync && <> Last sync {fmtLocalDay(o.lastSync, profile.timezone)}.</>}
                  </CardDescription>
                </CardHeader>
                <CardContent><VitalsGrid vitals={o.vitals} /></CardContent>
              </Card>

              <UpdatesFeed items={o.feed} parentName={profile.parentName} />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <OverviewCalendar items={o.calendar} today={o.today} />

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Pill className="size-4" /> Medications</CardTitle></CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {meds.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium">{m.name} {m.dose}</p>
                          <p className="text-xs text-muted-foreground">{m.frequency}</p>
                        </div>
                        <span className={`text-right text-xs ${m.daysLeft <= 7 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {m.daysLeft <= 0 ? "Out of supply" : `${m.daysLeft} days left`}
                          <br />{fmtLocalDay(m.runsOut.toISOString(), profile.timezone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
