"use client";

import { useEffect, useRef, useState } from "react";
import {
  ALL_SLOTS, BOOKING_STEPS, BOOKING_STEPS_DONE, HR_14, HR_30, HR_ALERT, HR_USUAL, PHARMACY, REFILL_STEPS, REFILL_STEPS_DONE, SLOTS,
  cannedAnswer, type Fulfillment, type Slot, type Step,
} from "@/lib/care-demo";
import { AgentMessage, AgentProgress, AgentSheet, AskThread, ChipRow, NotADoctor, SheetFooter, type ChipSpec } from "./agent-sheet";
import { RefillTiles } from "./needs-you-card";
import { RadioRow, UserBubble } from "./ui";
import { useAsk } from "./use-ask";

// Animates the agent's steps while a (fake) API call runs: each step ticks to done in turn, and the
// last one finishes when the call resolves.
function useAgentRun<T>(working: string[], done: string[], task: () => Promise<T>, active: boolean, onDone: (r: T) => void) {
  const [n, setN] = useState(active ? 1 : working.length);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const timers = working.slice(1).map((_, i) => setTimeout(() => alive && setN((x) => Math.max(x, i + 2)), 900 * (i + 1)));
    const minTime = new Promise((r) => setTimeout(r, 900 * working.length));
    Promise.all([task(), minTime]).then(([r]) => {
      if (!alive) return;
      setN(working.length + 1);
      onDone(r);
    }).catch(() => alive && setN(working.length + 1));
    return () => { alive = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const finished = n > working.length;
  const steps: Step[] = (finished ? done : working).map((label, i) => ({
    label, state: finished || i < n - 1 ? "done" : i === n - 1 ? "work" : "todo",
  }));
  return { steps: steps.filter((s) => s.state !== "todo"), finished };
}

// ---------- Flow 1: heart rate ----------

function hrPath(vals: number[], w: number, h: number, pad = 6) {
  const min = 58, max = 76;
  const x = (i: number) => +((i / (vals.length - 1)) * (w - pad * 2) + pad).toFixed(1);
  const y = (v: number) => +(h - pad - ((v - min) / (max - min)) * (h - pad * 2)).toFixed(1);
  return { pts: vals.map((v, i) => `${x(i)},${y(v)}`).join(" "), x, y };
}

export function HrChartSheet({ onClose, onMonth, onBook }: { onClose: () => void; onMonth: () => void; onBook: () => void }) {
  const ctx = "A sheet with Dad's 14-day resting heart rate chart: 64 bpm usual, above 70 for the last 5 days, 72 today. No irregular rhythm alerts. Sleep and steps steady.";
  const { turns, ask, busy } = useAsk(ctx);
  const { pts, y } = hrPath(HR_14, 300, 60, 2);
  const chips: ChipSpec[] = [
    { label: "Show me the month", onClick: onMonth },
    { label: "Book Dr. Lee", onClick: onBook },
    { label: "What should I ask Dr. Lee?", onClick: () => ask("What should I ask Dr. Lee?") },
  ];
  return (
    <AgentSheet open onClose={onClose} title="CareAgent" via="Resting heart rate" scrollKey={turns.map((t) => t.answer).join()}
      footer={<SheetFooter placeholder="Ask about heart rate" onAsk={ask} busy={busy} />}>
      <div className="rounded-[18px] border-[1.5px] border-coral-line bg-coral-tint p-3.5">
        <div className="flex items-center justify-between text-xs font-semibold text-coral-ink"><span>Resting heart rate</span><span>Last 14 days</span></div>
        <p className="mt-1.5 text-base font-extrabold">72 bpm today</p>
        <svg viewBox="0 0 300 60" width="100%" height="60" preserveAspectRatio="none" role="img" aria-label="Resting heart rate, last 14 days: near 64, then above 70 for 5 days" className="mt-1.5">
          <line x1="0" y1={y(HR_USUAL)} x2="300" y2={y(HR_USUAL)} stroke="#8C2A13" strokeOpacity="0.35" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <polyline points={pts} fill="none" stroke="#B1361A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="mt-1 text-xs text-coral-ink">Dashed line is his usual, 64 bpm</p>
      </div>
      <UserBubble>Why is this flagged?</UserBubble>
      <AgentMessage>
        <p>Dad&apos;s resting heart rate has been above 70 for 5 days in a row. Over the past month it sat around 64.</p>
        <p>His watch hasn&apos;t logged any irregular rhythm, and his sleep and steps are steady, so this isn&apos;t urgent. It&apos;s still worth a check with Dr. Lee, since he takes Lisinopril for blood pressure.</p>
      </AgentMessage>
      <NotADoctor />
      <ChipRow chips={chips} disabled={busy} />
      <AskThread turns={turns} />
    </AgentSheet>
  );
}

const RANGES = { Week: 7, Month: 30, "3 months": 90 } as const;
type Range = keyof typeof RANGES;
const HR_90 = [...Array.from({ length: 60 }, (_, i) => [64, 63, 65, 64, 62, 65, 64, 63, 66, 64][i % 10]), ...HR_30];

export function HrMonthSheet({ onClose, onBack, onFindTime }: { onClose: () => void; onBack: () => void; onFindTime: () => void }) {
  const [range, setRange] = useState<Range>("Month");
  const vals = range === "Week" ? HR_30.slice(-7) : range === "Month" ? HR_30 : HR_90;
  const { pts, x, y } = hrPath(vals, 330, 150, 8);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const ctx = `The expanded resting heart rate view, ${range.toLowerCase()} range: average ${avg}, highest ${Math.max(...vals)}, 5 days over 70, rise started Nov 12. Usual 64.`;
  const { turns, ask, busy } = useAsk(ctx);
  const from = { Week: "Nov 10", Month: "Oct 18", "3 months": "Aug 19" }[range];

  return (
    <AgentSheet open tall onClose={onClose} onBack={onBack} title="Resting heart rate" scrollKey={turns.map((t) => t.answer).join()}
      footer={<SheetFooter action={{ label: "Find a time with Dr. Lee", onClick: onFindTime }} placeholder="Ask about heart rate" onAsk={ask} busy={busy} />}>
      <div role="radiogroup" aria-label="Range" className="grid grid-cols-3 gap-1 rounded-full bg-[#F2F2F2] p-1">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)}
            className={`min-h-9 rounded-full text-sm ${range === r ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.12)]" : "font-semibold text-ink-2"}`}>{r}</button>
        ))}
      </div>
      <div>
        <p className="text-[13px] text-ink-2">{from} to Nov 16</p>
        <p className="mt-0.5 text-[44px] font-extrabold leading-none tracking-[-1.5px]">72<span className="text-base font-semibold tracking-normal text-ink-2"> bpm today</span></p>
      </div>
      <div className="rounded-[20px] bg-coral-tint px-3 pb-2 pt-3.5">
        <svg viewBox="0 0 330 150" width="100%" height="150" role="img" aria-label={`Resting heart rate, ${range.toLowerCase()}: flat near 64 until 5 days ago, then 70 to 73`}>
          <line x1="0" y1={y(HR_ALERT)} x2="330" y2={y(HR_ALERT)} stroke="#B1361A" strokeOpacity="0.55" strokeDasharray="2 4" />
          <line x1="0" y1={y(HR_USUAL)} x2="330" y2={y(HR_USUAL)} stroke="#8C2A13" strokeOpacity="0.35" strokeDasharray="5 4" />
          <polyline points={pts} fill="none" stroke="#B1361A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {vals.map((v, i) => v >= HR_ALERT && <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#B1361A" stroke="#FDF0EC" strokeWidth="2" />)}
        </svg>
        <div className="flex justify-between px-0.5 pt-0.5 text-[11px] text-coral-ink"><span>{from}</span><span>Nov 16</span></div>
        <div className="mt-2 flex gap-3.5 text-xs text-coral-ink"><span>Dashed: usual 64</span><span>Dotted: alert at 70</span></div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label={`${RANGES[range]}-day avg`} value={String(avg)} />
        <Stat label="Highest" value={String(Math.max(...vals))} />
        <Stat label="Days over 70" value="5" alert />
      </div>
      <div className="flex gap-2.5 rounded-2xl bg-soft p-3.5">
        <span className="mt-0.5"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A7A74" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" /></svg></span>
        <p className="text-sm leading-snug text-ink-body">The rise started Nov 12. His sleep and activity didn&apos;t change, so a visit with Dr. Lee is a sensible next step. Nothing here looks like an emergency.</p>
      </div>
      <ChipRow disabled={busy} chips={[
        { label: "What changed on Nov 12?", onClick: () => ask("What changed on Nov 12?") },
        { label: "Compare to 3 months", onClick: () => setRange("3 months") },
        { label: "Keep watching for a week", onClick: () => ask("Keep watching for a week and tell me if it keeps going up.") },
      ]} />
      <AskThread turns={turns} />
    </AgentSheet>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${alert ? "border-coral-line bg-[#FFFAF8] text-coral-ink" : "border-line"}`}>
      <p className={`text-xs ${alert ? "" : "text-ink-2"}`}>{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

// ---------- Flow 1: booking through Zocdoc ----------

export function BookingSheet({ phase, onPhase, onClose, onBook, alsoDad, onAlsoDad }: {
  phase: "working" | "times";
  onPhase: (p: "times") => void;
  onClose: () => void;
  onBook: (s: Slot) => Promise<void>;
  alsoDad: boolean;
  onAlsoDad: (v: boolean) => void;
}) {
  const [pref, setPref] = useState<{ mornings: boolean; nextWeek: boolean; later: boolean }>({ mornings: false, nextWeek: false, later: false });
  const [slotId, setSlotId] = useState(SLOTS[0].id);
  const [booking, setBooking] = useState(false);
  const ctx = "The Booking Dr. Lee sheet: a cardiology follow-up through Zocdoc. Open in-network times for Blue Shield PPO: Thu Dec 3 10:00 AM, Fri Dec 4 8:30 AM, Tue Dec 8 2:15 PM. Maya picks one and taps Book to approve.";
  const { turns, ask, busy } = useAsk(ctx);
  const run = useAgentRun(BOOKING_STEPS, BOOKING_STEPS_DONE,
    () => fetch("/api/care/zocdoc?provider_id=zd_cardio_001").then((r) => r.json()),
    phase === "working", () => onPhase("times"));

  const options = (pref.later ? ALL_SLOTS : SLOTS)
    .filter((s) => !pref.mornings || s.morning)
    .filter((s) => !pref.nextWeek || ["s1", "s2"].includes(s.id));
  const selected = options.find((s) => s.id === slotId) ?? options[0];
  const steps = phase === "times" ? BOOKING_STEPS_DONE.map((label) => ({ label, state: "done" as const })) : run.steps;
  const toggle = (k: keyof typeof pref) => setPref((p) => ({ ...p, [k]: !p[k] }));
  const count = ["no", "one", "two", "three", "four", "five"][options.length];

  const chips: ChipSpec[] = phase === "working"
    ? [
        { label: "Mornings only", onClick: () => toggle("mornings"), active: pref.mornings },
        { label: "Next week only", onClick: () => toggle("nextWeek"), active: pref.nextWeek },
        { label: "Could it be a video visit?", onClick: () => ask("Could it be a video visit?") },
      ]
    : [
        { label: "What will Dr. Lee check?", onClick: () => ask("What will Dr. Lee check?") },
        { label: "Add it to Dad's calendar too", onClick: () => onAlsoDad(!alsoDad), active: alsoDad },
        { label: pref.later ? "Fewer times" : "Show later times", onClick: () => toggle("later") },
        ...(pref.mornings ? [{ label: "Mornings only", onClick: () => toggle("mornings"), active: true }] : []),
      ];

  return (
    <AgentSheet open onClose={onClose} title="Booking Dr. Lee" via="Cardiology follow-up through Zocdoc" scrollKey={turns.map((t) => t.answer).join()}
      footer={<SheetFooter placeholder="Ask about this booking" onAsk={ask} busy={busy}
        action={phase === "times" && selected ? {
          label: booking ? "Booking" : `Book ${selected.short}`, disabled: booking,
          note: "Tapping Book is your approval. Nothing is booked until you do.",
          onClick: async () => { setBooking(true); await onBook(selected); setBooking(false); },
        } : undefined} />}>
      <UserBubble>Book a follow-up with Dr. Lee</UserBubble>
      <AgentProgress steps={steps} />
      {phase === "working" ? (
        <AgentMessage><p>This takes a few seconds. Tell me anything that should shape the times, or close this and I&apos;ll put them in Needs you.</p></AgentMessage>
      ) : (
        <>
          <AgentMessage>
            <p>{options.length
              ? `Dr. Lee has ${count} open ${options.length === 1 ? "time" : "times"}${pref.mornings ? " in the morning" : ""}${pref.later ? " in the next three weeks" : " in the next two weeks"}, all in network for Blue Shield PPO.`
              : "No times match that. Try removing a filter."}</p>
          </AgentMessage>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Choose a time</legend>
            {options.map((s) => (
              <RadioRow key={s.id} name="slot" checked={selected?.id === s.id} onChange={() => setSlotId(s.id)} title={`${s.day} at ${s.time}`} sub={s.note} />
            ))}
          </fieldset>
        </>
      )}
      <ChipRow chips={chips} disabled={busy} />
      <AskThread turns={turns} />
    </AgentSheet>
  );
}

// ---------- Flow 3: refill through Walgreens ----------

export function RefillSheet({ phase, onPhase, onClose, fulfillment, onFulfillment, supply, onSupply, onApprove }: {
  phase: "working" | "approve";
  onPhase: (p: "approve") => void;
  onClose: () => void;
  fulfillment: Fulfillment;
  onFulfillment: (f: Fulfillment) => void;
  supply: 30 | 90;
  onSupply: (s: 30 | 90) => void;
  onApprove: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const ctx = `The Refilling Lisinopril sheet: Lisinopril 10 mg, Rx ending 4471 at ${PHARMACY.name}, prescribed by Dr. Patel, 2 refills left, ${supply}-day supply, copay ${supply === 30 ? "$4.00" : "$10.00"}, ${fulfillment === "pickup" ? "pickup ready Wed" : "delivery arrives Thu"}. Maya taps Approve refill to send it.`;
  const { turns, ask, busy } = useAsk(ctx);
  const run = useAgentRun(REFILL_STEPS, REFILL_STEPS_DONE,
    () => fetch(`/api/care/walgreens?rx=${PHARMACY.rxNumber}`).then((r) => r.json()),
    phase === "working", () => onPhase("approve"));
  const steps = phase === "approve" ? REFILL_STEPS_DONE.map((label) => ({ label, state: "done" as const })) : run.steps;
  const supplyChip = { label: supply === 90 ? "Back to a 30-day supply" : "Switch to a 90-day supply", onClick: () => onSupply(supply === 90 ? 30 : 90), active: supply === 90 };

  const chips: ChipSpec[] = phase === "working"
    ? [
        { label: "Deliver it instead", onClick: () => onFulfillment(fulfillment === "delivery" ? "pickup" : "delivery"), active: fulfillment === "delivery" },
        supplyChip,
        { label: "Use a different Walgreens", onClick: () => ask("Use a different Walgreens") },
      ]
    : [
        { label: `Why is the copay ${supply === 30 ? "$4.00" : "$10.00"}?`, onClick: () => ask(`Why is the copay ${supply === 30 ? "$4.00" : "$10.00"}?`) },
        { label: "Remind Dad to pick it up", onClick: () => ask("Remind Dad to pick it up") },
        supplyChip,
      ];

  return (
    <AgentSheet open onClose={onClose} title="Refilling Lisinopril" via={`10 mg through ${PHARMACY.name}`} scrollKey={turns.map((t) => t.answer).join()}
      footer={<SheetFooter placeholder="Ask about this refill" onAsk={ask} busy={busy}
        action={phase === "approve" ? {
          label: sending ? "Sending" : "Approve refill", disabled: sending, note: "Tapping Approve sends it to Walgreens.",
          onClick: async () => { setSending(true); await onApprove(); setSending(false); },
        } : undefined} />}>
      <UserBubble>Refill Lisinopril</UserBubble>
      <AgentProgress steps={steps} />
      {phase === "working" ? (
        <AgentMessage><p>Almost there. Ask me anything about this refill while I finish.</p></AgentMessage>
      ) : (
        <>
          <AgentMessage><p>It&apos;s ready to send. Choose pickup or delivery.</p></AgentMessage>
          <RefillTiles supply={supply} />
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Pickup or delivery</legend>
            <RadioRow name="get" checked={fulfillment === "pickup"} onChange={() => onFulfillment("pickup")} title="Pickup, ready Wed" sub={PHARMACY.name} />
            <RadioRow name="get" checked={fulfillment === "delivery"} onChange={() => onFulfillment("delivery")} title="Delivery, arrives Thu" sub="To Dad's home, free" />
          </fieldset>
        </>
      )}
      <ChipRow chips={chips} disabled={busy} />
      <AskThread turns={turns} />
    </AgentSheet>
  );
}

// ---------- Ask anything (Message CareAgent, other vital tiles) ----------

export function AskSheet({ title, context, first, onClose }: { title: string; context: string; first?: string; onClose: () => void }) {
  const { turns, ask, busy } = useAsk(context);
  const asked = useRef(false);
  useEffect(() => {
    if (first && !asked.current) { asked.current = true; ask(first); }
  }, [first, ask]);
  const suggestions = ["Is Dad okay this week?", "What should I ask Dr. Lee?"].filter((q) => q !== first && !turns.some((t) => t.question === q));
  return (
    <AgentSheet open onClose={onClose} title="CareAgent" via={title} scrollKey={turns.map((t) => t.answer).join()}
      footer={<SheetFooter placeholder={`Ask about ${title.toLowerCase()}`} onAsk={ask} busy={busy} />}>
      {!turns.length && <AgentMessage><p>{cannedAnswer("Is Dad okay this week?")}</p></AgentMessage>}
      <AskThread turns={turns} />
      {!busy && <ChipRow chips={suggestions.map((q) => ({ label: q, onClick: () => ask(q) }))} />}
    </AgentSheet>
  );
}
