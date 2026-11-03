import { BellRing, CalendarDays, ClipboardCheck, Pill } from "lucide-react";
import type { Stats } from "@/lib/overview";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function Stat({ icon: Icon, label, value, children, tone }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  tone?: "alert" | "warn";
}) {
  return (
    <Card className={cn("gap-0 py-3", tone === "alert" && "border-destructive/40", tone === "warn" && "border-amber-500/50")}>
      <CardContent className="flex h-full flex-col gap-1 px-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
        <div className="font-heading text-xl leading-tight">{value}</div>
        {children && <div className="mt-auto pt-1 text-xs text-muted-foreground">{children}</div>}
      </CardContent>
    </Card>
  );
}

export function StatCards({ stats }: { stats: Stats }) {
  const refill = stats.nextRefill;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={BellRing} label="Open alerts" value={stats.openAlerts}
        tone={stats.topSeverity === "urgent" ? "alert" : stats.openAlerts ? "warn" : undefined}>
        {stats.topSeverity ? <SeverityBadge severity={stats.topSeverity} /> : "All clear"}
      </Stat>
      <Stat icon={ClipboardCheck} label="Waiting on family" value={stats.pendingApprovals}
        tone={stats.pendingApprovals ? "warn" : undefined}>
        {stats.pendingApprovals ? "Needs an approval" : "Nothing to approve"}
      </Stat>
      <Stat icon={CalendarDays} label="Next visit" value={<span className="text-base">{stats.nextVisit?.provider ?? "None booked"}</span>}>
        {stats.nextVisit?.when}
      </Stat>
      <Stat icon={Pill} label="Next refill" value={<span className="text-base">{refill?.name ?? "No meds"}</span>}
        tone={refill && refill.daysLeft <= 7 ? "warn" : undefined}>
        {refill && (
          <div className="flex flex-col gap-1.5">
            <span>{refill.daysLeft <= 0 ? "Out of supply" : `${refill.daysLeft} days left`}</span>
            <Progress value={refill.pct} className={cn("h-1.5", refill.daysLeft <= 7 && "[&>div]:bg-amber-500")} aria-label={`${refill.name} supply`} />
          </div>
        )}
      </Stat>
    </div>
  );
}
