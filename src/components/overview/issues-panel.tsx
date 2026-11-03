import Link from "next/link";
import { CircleCheck, Eye, Info, TriangleAlert } from "lucide-react";
import type { Issue } from "@/lib/overview";
import type { Severity } from "@/rules/alerts";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ICON: Record<Severity, React.ElementType> = { urgent: TriangleAlert, follow_up: TriangleAlert, watch: Eye, info: Info };
const TONE: Record<Severity, string> = {
  urgent: "border-l-destructive text-destructive",
  follow_up: "border-l-amber-500 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
  watch: "border-l-sky-500 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-400",
  info: "border-l-muted-foreground/40 [&>svg]:text-muted-foreground",
};

export function IssuesPanel({ issues, hasUrgent }: { issues: Issue[]; hasUrgent: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Needs attention</CardTitle>
        <CardDescription>
          {issues.length ? `${issues.length} thing${issues.length > 1 ? "s" : ""} to look at, most important first.` : "CareAgent checks alerts, approvals, refills, visits and syncing."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {issues.length === 0 && !hasUrgent && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> Nothing needs you right now.
          </div>
        )}
        {issues.map((issue) => {
          const Icon = ICON[issue.severity];
          return (
            <Alert key={issue.id} className={cn("border-l-4 pr-3", TONE[issue.severity])}>
              <Icon />
              <AlertTitle className="text-foreground">{issue.title}</AlertTitle>
              <AlertDescription>
                <p>{issue.detail}</p>
                <Button asChild variant="outline" size="sm" className="mt-2 h-7 rounded-full text-xs text-foreground">
                  <Link href="/">{issue.cta}</Link>
                </Button>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
