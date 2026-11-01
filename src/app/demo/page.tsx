import path from "node:path";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hasModelKey } from "@/agent/llm";
import { deviceFilePath, getWearableAdapter, SCENARIOS, type ScenarioName } from "@/fakes/wearables";
import { getCurrentProfile } from "@/lib/profile";
import { SubmitButton } from "@/components/submit-button";
import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dailyReview, resetDemo, syncDevice, triggerScenario } from "../actions";

export default function DemoPage() {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const adapter = getWearableAdapter(profile.wearableSource);
  const readingCount = db.select({ n: count() }).from(schema.readings)
    .where(eq(schema.readings.careProfileId, profile.id)).get()!.n;
  const online = hasModelKey();

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Demo controls" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 pt-2 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Dev only. Agent: {online ? "online" : "offline (add OPENAI_API_KEY to .env)"} · {readingCount} readings synced.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wearable scenarios</CardTitle>
              <CardDescription>Simulates the watch uploading new data. Rules check it, and the agent decides what to tell the family.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SCENARIOS) as ScenarioName[]).map((name) => {
                const supported = adapter.metrics.includes(SCENARIOS[name].metric);
                return (
                  <form key={name} action={triggerScenario} className="flex flex-col gap-2 rounded-xl border p-3">
                    <input type="hidden" name="scenario" value={name} />
                    <p className="text-sm font-medium">{SCENARIOS[name].label}</p>
                    <p className="flex-1 text-xs text-muted-foreground">{SCENARIOS[name].description}</p>
                    <SubmitButton size="sm" className="self-start rounded-full" disabled={!supported}>
                      {supported ? "Trigger" : `Not reported by ${adapter.source}`}
                    </SubmitButton>
                  </form>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fake data sources</CardTitle>
              <CardDescription>
                The watch&apos;s cloud is a JSON file: <code className="text-xs">{path.relative(process.cwd(), deviceFilePath(profile.wearableSource))}</code>.
                Edit it, then sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <form action={syncDevice}><SubmitButton variant="outline" size="sm" className="rounded-full">Sync from device file</SubmitButton></form>
              <form action={dailyReview}><SubmitButton variant="outline" size="sm" className="rounded-full" disabled={!online}>Run daily review</SubmitButton></form>
              <form action={resetDemo}><SubmitButton variant="outline" size="sm" className="rounded-full text-destructive" pendingText="Resetting…">Reset demo data</SubmitButton></form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
