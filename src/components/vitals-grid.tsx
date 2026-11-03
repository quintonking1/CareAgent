"use client";

import { useState } from "react";
import { Area, AreaChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { VitalSummary } from "@/lib/blocks";
import { fmtDay } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const fmt = (v: number, unit: string) =>
  unit === "steps" ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? String(v) : v.toFixed(1);

function VitalChart({ v, days }: { v: VitalSummary; days: number }) {
  const hl = new Set(v.alert?.highlight ?? []);
  const data = v.points.slice(-days).map((p) => ({ day: fmtDay(p.date), value: p.value, flagged: hl.has(p.id) }));
  const color = v.flagged ? "var(--destructive)" : "var(--chart-1)";
  const config = { value: { label: v.label, color } } satisfies ChartConfig;
  const id = `fill-${v.metric}`;
  const up = v.deltaPct >= 0;
  const notable = Math.abs(v.deltaPct) >= 10;

  return (
    <div className={cn("rounded-xl border bg-background/60 p-3", v.flagged && "border-destructive/40")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{v.label}</p>
          <p className="font-heading text-xl leading-tight">
            {fmt(v.latest, v.unit)} <span className="font-sans text-xs text-muted-foreground">{v.unit !== "steps" && v.unit}</span>
          </p>
        </div>
        <span className={cn(
          "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs",
          notable ? (v.flagged ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300") : "bg-muted text-muted-foreground",
        )}>
          {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {up ? "+" : ""}{v.deltaPct.toFixed(0)}%
        </span>
      </div>
      <ChartContainer config={config} className="mt-2 aspect-auto h-20 w-full">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[
            (min: number) => Math.min(min, v.baseline) * 0.92,
            (max: number) => Math.max(max, v.alert?.threshold ?? max) * 1.08,
          ]} />
          <ReferenceLine y={v.baseline} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeOpacity={0.6} />
          {v.alert?.threshold != null && (
            <ReferenceLine y={v.alert.threshold} stroke="var(--destructive)" strokeDasharray="2 4" strokeOpacity={0.7} />
          )}
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Area dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number; payload?: { flagged: boolean } }) =>
              p.payload?.flagged
                ? <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="var(--destructive)" stroke="var(--card)" strokeWidth={1.5} />
                : <g key={p.index} />} />
        </AreaChart>
      </ChartContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        Usual: {fmt(v.baseline, v.unit)} {v.unit} (grey line)
        {v.alert?.threshold != null && <> · Alert above {fmt(v.alert.threshold, v.unit)} (red line)</>}
      </p>
      {v.alert && (
        <p className="mt-2 rounded-lg bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
          <span className="font-medium">{v.alert.label}.</span> {v.alert.description}
        </p>
      )}
    </div>
  );
}

// 2x2 grid of mini charts; the 7/30-day toggle sits above it.
export function VitalsGrid({ vitals, className }: { vitals: VitalSummary[]; className?: string }) {
  const [days, setDays] = useState(30);
  if (!vitals.length) return <p className="text-sm text-muted-foreground">No readings synced yet.</p>;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ToggleGroup type="single" variant="outline" size="sm" value={String(days)}
        onValueChange={(v) => v && setDays(Number(v))} className="self-start">
        <ToggleGroupItem value="7" className="px-3 text-xs">7 days</ToggleGroupItem>
        <ToggleGroupItem value="30" className="px-3 text-xs">30 days</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {vitals.map((v) => <VitalChart key={v.metric} v={v} days={days} />)}
      </div>
    </div>
  );
}
