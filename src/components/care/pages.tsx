"use client";

import { Check, ChevronLeft, X } from "lucide-react";
import { useState } from "react";
import { DR_LEE, PHARMACY, type Fulfillment, type Slot } from "@/lib/care-demo";
import { AgentMark, DoneDot, PrimaryButton, SecondaryButton, Spinner, Sparkline, TextButton, TodoDot } from "./ui";

// Full-screen page an approval hands off to. Done returns to the home, which then shows the status line.
export function ConfirmationPage({ title, sub, children, onDone, secondary }: {
  title: string;
  sub: string;
  children: React.ReactNode;
  onDone: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <main className="flex min-h-svh flex-col px-5 pb-7" aria-labelledby="confirm-h">
      <div aria-hidden className="mt-24 flex size-[72px] items-center justify-center rounded-full bg-teal-tint text-teal">
        <Check className="size-[34px]" strokeWidth={2.6} />
      </div>
      <h1 id="confirm-h" className="mt-6 text-[28px] font-bold leading-[1.15] tracking-[-0.6px]">{title}</h1>
      <p className="mt-2 text-base text-ink-body" role="status">{sub}</p>
      {children}
      <div className="flex-1" />
      <div className="flex flex-col gap-2 pt-8">
        <PrimaryButton size="lg" onClick={onDone}>Done</PrimaryButton>
        {secondary && <TextButton onClick={secondary.onClick}>{secondary.label}</TextButton>}
      </div>
    </main>
  );
}

function CheckRow({ children, agent }: { children: React.ReactNode; agent?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-snug">
      {agent ? <AgentMark className="mt-px size-5 shrink-0" /> : <Check aria-hidden className="mt-px size-5 shrink-0 text-teal" strokeWidth={2.4} />}
      <span>{children}</span>
    </li>
  );
}

export function BookedPage({ slot, alsoDad, onDone, onChange }: { slot: Slot; alsoDad: boolean; onDone: () => void; onChange: () => void }) {
  return (
    <ConfirmationPage title="Booked with Dr. Lee" sub={`${slot.weekday}, ${slot.day.split(", ")[1]} at ${slot.time}`} onDone={onDone} secondary={{ label: "Change time", onClick: onChange }}>
      <div className="mt-8 flex items-center gap-3.5 rounded-[20px] border border-line p-4 shadow-card">
        <div className="w-14 shrink-0 rounded-xl bg-soft py-2 text-center" aria-hidden>
          <p className="text-[11px] font-bold tracking-[0.5px] text-coral">DEC</p>
          <p className="text-[22px] font-bold leading-tight">{slot.dayNum}</p>
        </div>
        <div>
          <p className="text-base font-bold">{DR_LEE.name}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">Cardiology, in network for Blue Shield PPO</p>
        </div>
      </div>
      <ul className="mt-8 flex flex-col gap-3.5">
        <CheckRow>{alsoDad ? "Added to your calendar and Dad's" : "Added to your calendar"}</CheckRow>
        <CheckRow>Heart rate trend attached to the visit</CheckRow>
        <CheckRow agent>I&apos;ll have a pre-visit brief ready the evening before</CheckRow>
      </ul>
    </ConfirmationPage>
  );
}

export function RefillSentPage({ fulfillment, supply, onDone, onChange }: { fulfillment: Fulfillment; supply: 30 | 90; onDone: () => void; onChange: () => void }) {
  const steps = [
    { label: "Sent to Walgreens", sub: "Mon 6:20 PM", state: "done" },
    { label: "Being filled", sub: PHARMACY.name, state: "work" },
    fulfillment === "pickup"
      ? { label: "Ready for pickup", sub: `Expected Wed, ${supply === 30 ? "$4.00" : "$10.00"} copay`, state: "todo" }
      : { label: "Delivered to Dad's home", sub: `Expected Thu, ${supply === 30 ? "$4.00" : "$10.00"} copay`, state: "todo" },
  ] as const;
  return (
    <ConfirmationPage title="Refill sent to Walgreens" sub={`Lisinopril 10 mg, ${fulfillment === "pickup" ? "pickup Wednesday" : "delivery Thursday"}`}
      onDone={onDone} secondary={{ label: "Change pickup or delivery", onClick: onChange }}>
      <div className="mt-8 rounded-[20px] border border-line p-5 shadow-card">
        <ol aria-label="Refill progress">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-3">
              <span className="flex flex-col items-center">
                {s.state === "done" ? <DoneDot /> : s.state === "work" ? <Spinner /> : <TodoDot />}
                {i < steps.length - 1 && <span aria-hidden className="my-1 min-h-5 w-0.5 flex-1 bg-line" />}
              </span>
              <span className={i < steps.length - 1 ? "pb-3" : ""}>
                <span className={`block text-[15px] ${s.state === "work" ? "font-bold" : "font-semibold"} ${s.state === "todo" ? "text-ink-2" : ""}`}>{s.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">{s.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 text-[15px] leading-snug text-ink-body">
        {fulfillment === "pickup" ? "I'll let you know when it's ready and remind Dad to pick it up." : "I'll let you know when it ships and when it arrives."}
      </p>
    </ConfirmationPage>
  );
}

// ---------- Flow 2: pre-visit brief ----------

const BASE_QUESTIONS = ["What could be raising his resting heart rate?", "Should any of his medications change?", "When should we check it again?"];
const MEDS = [["Lisinopril 10 mg", "Once daily"], ["Metformin 500 mg", "Twice daily"], ["Atorvastatin 20 mg", "Once daily"]];

function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-11 items-center justify-center rounded-full">
      <ChevronLeft className="size-5" strokeWidth={2.4} />
    </button>
  );
}

export function BriefPage({ slot, questions, onQuestions, onBack, onReady }: {
  slot: Slot; questions: string[]; onQuestions: (q: string[]) => void; onBack: () => void; onReady: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <main className="flex min-h-svh flex-col" aria-labelledby="brief-h">
      <header className="px-3 pt-9"><Back onClick={onBack} /></header>
      <div className="px-5 pt-2">
        <h1 id="brief-h" className="text-[28px] font-bold tracking-[-0.6px]">Brief for Dr. Lee</h1>
        <p className="mt-2 text-[15px] text-ink-body">{slot.day} at {slot.time}, cardiology follow-up</p>
      </div>

      <section className="mx-5 mt-8">
        <h2 className="mb-3 text-[17px] font-semibold">Wearable trends</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-[1.5px] border-coral-line bg-coral-tint p-3">
            <p className="text-xs font-semibold text-coral-ink">Resting HR</p>
            <p className="mt-1 text-[22px] font-semibold">72 <span className="text-xs text-coral-ink">vs 64 usual</span></p>
            <Sparkline points={[64, 63, 65, 64, 63, 64, 70, 71, 72, 73, 72]} color="#B1361A" height={30} />
          </div>
          <div className="rounded-2xl bg-indigo-tint p-3">
            <p className="text-xs font-semibold text-indigo-ink">Sleep</p>
            <p className="mt-1 text-[22px] font-semibold">7.1 <span className="text-xs text-indigo-ink">h, normal</span></p>
            <Sparkline points={[6.8, 7.2, 7.0, 6.9, 7.3, 7.1, 6.9, 7.2, 7.0, 7.1]} color="#4A54B5" height={30} />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-2">Last 30 days from his Apple Watch</p>
      </section>

      <section className="mx-5 mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">Medications</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {MEDS.map(([n, f]) => <li key={n} className="flex justify-between px-3.5 py-3 text-sm"><span className="font-bold">{n}</span><span className="text-ink-2">{f}</span></li>)}
        </ul>
      </section>

      <section className="mx-5 mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">Recent alerts</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-snug">
          <li>Resting heart rate above 70 for 5 days, starting Nov 12</li>
          <li>No falls and no irregular rhythm alerts</li>
        </ul>
      </section>

      <section className="mx-5 mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">Questions to ask</h2>
        <ul className="flex flex-col gap-2">
          {questions.map((q) => (
            <li key={q} className="flex items-start gap-2 rounded-[14px] bg-soft py-1 pl-3.5 pr-1 text-sm leading-snug">
              <span className="flex-1 py-2">{q}</span>
              {!BASE_QUESTIONS.includes(q) && (
                <button type="button" aria-label={`Remove: ${q}`} onClick={() => onQuestions(questions.filter((x) => x !== q))} className="flex size-11 shrink-0 items-center justify-center rounded-full">
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onQuestions([...questions, draft.trim()]); setDraft(""); } }}>
          <label htmlFor="q-new" className="block text-[13px] font-bold">Add your own question</label>
          <div className="mt-2 flex gap-2">
            <input id="q-new" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a question for Dr. Lee"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-3 text-sm outline-none focus:border-ink" />
            <SecondaryButton type="submit" className="min-h-11 px-4 text-sm">Add</SecondaryButton>
          </div>
        </form>
      </section>

      <div className="flex-1" />
      <div className="sticky bottom-0 mt-6 border-t border-line bg-white px-5 pb-7 pt-3">
        <PrimaryButton size="lg" className="w-full" onClick={onReady}>Mark ready</PrimaryButton>
      </div>
    </main>
  );
}

export { BASE_QUESTIONS };

export function BriefReadyPage({ slot, questionCount, onShow, onShare, onDone, shared }: {
  slot: Slot; questionCount: number; onShow: () => void; onShare: () => void; onDone: () => void; shared: boolean;
}) {
  return (
    <main className="flex min-h-svh flex-col px-5 pb-7" aria-labelledby="ready-h">
      <h1 id="ready-h" className="mt-28 text-[30px] font-bold leading-[1.15] tracking-[-0.6px]">Brief is ready</h1>
      <p className="mt-2 text-base text-ink-body">{DR_LEE.short}, {slot.day} at {slot.time}</p>
      <p className="mt-4 text-[15px] leading-normal text-ink-body">It includes his heart rate trend, 3 medications, 2 alerts and {questionCount} questions.</p>
      {shared && <p role="status" className="mt-4 rounded-[14px] bg-ok-tint px-4 py-3 text-[15px] font-bold text-ok">Shared with Dr. Lee&apos;s office</p>}
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        <PrimaryButton size="lg" onClick={onShow}>Show at the visit</PrimaryButton>
        <SecondaryButton className="min-h-[52px] rounded-[14px] text-base font-bold" onClick={onShare} disabled={shared}>
          {shared ? "Shared" : "Share with Dr. Lee's office"}
        </SecondaryButton>
        {!shared && <p className="text-center text-xs text-ink-2">Tapping Share sends the brief to Dr. Lee&apos;s office.</p>}
        <TextButton onClick={onDone}>Back to home</TextButton>
      </div>
    </main>
  );
}

// Large, high-contrast view to hand the phone to the doctor.
export function BriefShowPage({ slot, questions, onClose }: { slot: Slot; questions: string[]; onClose: () => void }) {
  return (
    <main className="min-h-svh px-5 pb-10 pt-6" aria-labelledby="show-h">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-2">Robert Hayes, born Apr 12, 1951</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-soft"><X className="size-4" strokeWidth={2.4} /></button>
      </div>
      <h1 id="show-h" className="mt-4 text-[32px] font-bold leading-tight tracking-[-0.6px]">For {DR_LEE.name}</h1>
      <p className="mt-1 text-lg text-ink-body">{slot.day} at {slot.time}</p>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Resting heart rate</h2>
        <p className="mt-2 text-[22px] leading-snug">72 bpm now, usual 64. Above 70 for 5 days since Nov 12.</p>
        <p className="mt-2 text-lg leading-snug text-ink-body">No falls. No irregular rhythm alerts. Sleep 7.1 h, steps about 4,800 a day.</p>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Medications</h2>
        <ul className="mt-2 flex flex-col gap-1 text-lg">{MEDS.map(([n, f]) => <li key={n}>{n}, {f.toLowerCase()}</li>)}</ul>
        <p className="mt-2 text-lg text-ink-body">Allergic to penicillin</p>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Questions from the family</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-6 text-lg leading-snug">{questions.map((q) => <li key={q}>{q}</li>)}</ol>
      </section>
    </main>
  );
}

export function VisitNotesPage({ onBack, onSave, onFindTimes }: { onBack: () => void; onSave: (rx: string[]) => void; onFindTimes: () => void }) {
  const [notes, setNotes] = useState("Dr. Lee wants to recheck his heart rate in 4 weeks. Started a new medication.");
  const [rx, setRx] = useState(["Metoprolol 25 mg"]);
  const [adding, setAdding] = useState("");
  return (
    <main className="flex min-h-svh flex-col" aria-labelledby="notes-h">
      <header className="flex items-center gap-2 px-3 pt-9"><Back onClick={onBack} /><span className="text-[13px] text-ink-2">Thu, Dec 3</span></header>
      <div className="px-5 pt-2">
        <h1 id="notes-h" className="text-[26px] font-bold tracking-[-0.5px]">How did Dr. Lee&apos;s visit go?</h1>
        <label htmlFor="visit-notes" className="mt-5 block text-[13px] font-bold">Your notes</label>
        <textarea id="visit-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
          className="mt-2 w-full resize-none rounded-[14px] border border-line-strong p-3 text-[15px] leading-snug outline-none focus:border-ink" />
      </div>
      <section className="mx-5 mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">New prescriptions</h2>
        <ul className="flex flex-col gap-2">
          {rx.map((r) => (
            <li key={r} className="flex items-center gap-3 rounded-2xl border border-line py-1 pl-3.5 pr-1">
              <div className="flex-1 py-2.5">
                <p className="text-[15px] font-bold">{r}</p>
                <p className="mt-1 text-[13px] text-ink-2">Prescribed by Dr. Lee</p>
              </div>
              <button type="button" aria-label={`Remove ${r}`} onClick={() => setRx(rx.filter((x) => x !== r))} className="flex size-11 items-center justify-center rounded-full"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { setRx([...rx, adding.trim()]); setAdding(""); } }}>
          <label htmlFor="rx-new" className="sr-only">Add a prescription</label>
          <input id="rx-new" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a prescription"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-3 text-sm outline-none focus:border-ink" />
          <SecondaryButton type="submit" className="min-h-11 px-4 text-sm">Add</SecondaryButton>
        </form>
        <p className="mt-2 text-xs text-ink-2">Dr. Lee sends new prescriptions straight to Walgreens. I&apos;ll watch for them and add them to Medications.</p>
      </section>
      <section className="mx-5 mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">Follow-up</h2>
        <div className="flex items-center gap-3 rounded-2xl bg-soft p-3.5">
          <p className="flex-1 text-sm leading-snug">Recheck with Dr. Lee in about 4 weeks</p>
          <button type="button" onClick={onFindTimes} className="flex min-h-11 items-center rounded-full bg-ink px-3.5 text-sm font-semibold text-white">Find times</button>
        </div>
      </section>
      <div className="flex-1" />
      <div className="px-5 pb-7 pt-6">
        <PrimaryButton size="lg" className="w-full" onClick={() => onSave(rx)}>Save notes</PrimaryButton>
      </div>
    </main>
  );
}
