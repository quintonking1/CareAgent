"use client";

import Link from "next/link";
import { Activity, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkline } from "@/components/Sparkline";
import type { ChartPoint } from "@/lib/blocks";

// Links each agent-written status sentence to the data it summarizes.
export function StatusSources({ alerts, metrics }: {
  alerts: { id: number; label: string }[];
  metrics: { metric: string; label: string; unit: string; points: ChartPoint[] }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.map((a) => (
        <Badge key={a.id} asChild variant="outline" className="rounded-full font-normal">
          <Link href="/"><Bell /> {a.label}</Link>
        </Badge>
      ))}
      {metrics.map((m) => (
        <Dialog key={m.metric}>
          <DialogTrigger asChild>
            <Badge asChild variant="outline" className="cursor-pointer rounded-full font-normal">
              <button type="button"><Activity /> {m.label}</button>
            </Badge>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{m.label}</DialogTitle></DialogHeader>
            <Sparkline points={m.points} label={`${m.points.length} days · ${m.unit}`} />
            <ul className="max-h-48 overflow-y-auto text-sm text-muted-foreground">
              {[...m.points].reverse().slice(0, 7).map((p) => (
                <li key={p.id} className="flex justify-between border-b py-1 last:border-0">
                  <span>{p.date.slice(0, 10)}</span><span>{p.value} {m.unit}</span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
