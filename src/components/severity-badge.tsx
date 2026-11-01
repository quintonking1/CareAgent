import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Severity } from "@/rules/alerts";

const STYLES: Record<Severity, string> = {
  info: "bg-muted text-muted-foreground",
  watch: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  follow_up: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-destructive text-white",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded-full border-0 font-medium", STYLES[severity], className)}>
      {severity.replace("_", " ")}
    </Badge>
  );
}
