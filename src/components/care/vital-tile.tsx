"use client";

import type { Tone, Vital } from "@/lib/care-demo";
import { Sparkline } from "./ui";

// Each vital has its own soft tint: coral (only when flagged), indigo, teal and tan.
const TONES: Record<Tone, { bg: string; fg: string; line: string; chipBg: string; chipFg: string }> = {
  coral: { bg: "bg-coral-tint", fg: "text-coral-ink", line: "#B1361A", chipBg: "bg-coral", chipFg: "text-white" },
  indigo: { bg: "bg-indigo-tint", fg: "text-indigo-ink", line: "#4A54B5", chipBg: "bg-indigo-chip", chipFg: "text-indigo-ink" },
  teal: { bg: "bg-teal-tint", fg: "text-teal-ink", line: "#0A7A74", chipBg: "bg-teal-ring", chipFg: "text-teal-ink" },
  tan: { bg: "bg-tan-tint", fg: "text-tan-ink", line: "#A8651A", chipBg: "bg-tan-chip", chipFg: "text-tan-ink" },
};

export function VitalTile({ vital, onAsk }: { vital: Vital; onAsk: () => void }) {
  const t = TONES[vital.flagged || vital.tone !== "coral" ? vital.tone : "teal"];
  return (
    <article className={`flex flex-col gap-2 rounded-[20px] p-4 ${t.bg}`} aria-label={`${vital.label}, ${vital.value} ${vital.unit}, ${vital.usual}, ${vital.chip}`}>
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[13px] font-semibold ${t.fg}`}>{vital.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.chipBg} ${t.chipFg}`}>{vital.chip}</span>
      </div>
      <p className="text-[32px] font-semibold leading-none tracking-[-1px]">
        {vital.value}
        {vital.unit && <span className={`text-sm font-semibold tracking-normal ${t.fg}`}> {vital.unit}</span>}
      </p>
      <Sparkline points={vital.points} color={t.line} />
      <p className={`text-xs ${t.fg}`}>{vital.usual}</p>
      <button type="button" onClick={onAsk} className={`-my-2.5 inline-flex min-h-11 items-center self-start text-[13px] font-semibold underline-offset-2 hover:underline ${t.fg}`}>
        Ask about this
      </button>
    </article>
  );
}
