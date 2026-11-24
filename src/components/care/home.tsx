"use client";

import { ChevronDown, HeartPulse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  activitySummary, DAD, DR_LEE, PHARMACY, VITALS,
  type CardAction, type CareState, type Fulfillment, type HomeView, type Vital,
} from "@/lib/care-demo";
import { NeedsYouCard } from "./needs-you-card";
import { AskBox, Logo, PrimaryButton } from "./ui";
import { VitalTile } from "./vital-tile";

const H2 = "text-xl font-semibold tracking-[-0.3px]";

// The home. Section order is fixed; what's inside each section comes from the HomeView.
export function Home({ view, state, onAction, onAskVital, onAllCharts, onMessage, onRefill, onFulfillment, onApproveRefill, onOpenNotes }: {
  view: HomeView;
  state: CareState;
  onAction: (a: CardAction) => void;
  onAskVital: (v: Vital) => void;
  onAllCharts: () => void;
  onMessage: (text: string) => void;
  onRefill: () => void;
  onFulfillment: (f: Fulfillment) => void;
  onApproveRefill: () => void;
  onOpenNotes: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="relative flex min-h-svh flex-col">
      {view.notification && (
        <button
          type="button"
          onClick={onOpenNotes}
          className="absolute inset-x-3 top-3 z-10 flex gap-3 rounded-[20px] bg-white p-4 text-left shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-teal text-white"><HeartPulse className="size-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex justify-between text-[13px]"><span className="font-semibold">CareAgent</span><span className="text-ink-2">now</span></span>
            <span className="mt-1 block text-[15px] font-bold">{view.notification.title}</span>
            <span className="mt-1 block text-sm text-ink-2">{view.notification.body}</span>
          </span>
        </button>
      )}

      <div className="px-5 pb-6">
        <header className="pb-2 pt-10"><Logo /></header>

        {/* Headline + status */}
        <section aria-label="How Dad is doing" className="pt-3">
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.6px]">{view.h1}</h1>
          <p className="mt-2 text-base leading-[1.45] text-ink-body">{view.sub}</p>
          <div role="status" aria-live="polite">
            {view.status && <div className="mt-4 rounded-[14px] bg-ok-tint px-4 py-3 text-[15px] font-bold text-ok">{view.status}</div>}
          </div>
          {state.syncStale ? (
            <div role="status" className="mt-4 rounded-2xl border border-amber-line bg-amber-tint p-4 text-amber-ink">
              <p className="text-[15px] font-bold">No data since Tuesday</p>
              <p className="mt-1 text-sm leading-snug">Is Dad wearing his watch? It may be on the charger. The numbers below are from Tuesday.</p>
              <div className="mt-3 flex gap-2">
                <a href={`tel:${DAD.phone}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white">Call Dad</a>
                <button type="button" onClick={() => toast.success("Reminder sent to Dad: put your watch back on when it's charged.")}
                  className="min-h-11 flex-1 rounded-xl border border-[#C9A04A] text-sm font-semibold">Text a reminder</button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-2">Apple Watch synced 2h ago</p>
          )}
        </section>

        {/* Needs you */}
        <section aria-labelledby="h-needs" className="pt-10">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="h-needs" className={H2}>Needs you</h2>
            {view.needsCount > 0 && (
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-badge px-1.5 text-xs font-bold text-white" aria-label={`${view.needsCount} waiting`}>
                {view.needsCount}
              </span>
            )}
          </div>
          {view.cards.length ? (
            <div className="flex flex-col gap-3">
              {view.cards.map((c) => (
                <NeedsYouCard key={c.id} data={c} onAction={onAction} fulfillment={state.refillFulfillment} onFulfillment={onFulfillment} onApproveRefill={onApproveRefill} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-soft p-4 text-sm text-ink-2">You&apos;re all caught up.</p>
          )}
        </section>

        {/* Health this week */}
        <section aria-labelledby="h-health" className="pt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="h-health" className={H2}>Health this week</h2>
            <button type="button" onClick={onAllCharts} className="-my-3 min-h-11 text-sm font-semibold underline-offset-2 hover:underline">All charts</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {VITALS.map((v) => <VitalTile key={v.id} vital={v} onAsk={() => onAskVital(v)} />)}
          </div>
        </section>

        {/* Medications */}
        <section aria-labelledby="h-meds" className="pt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="h-meds" className={H2}>Medications</h2>
            <span className="text-[13px] text-ink-2">{PHARMACY.name}</span>
          </div>
          <ul className="divide-y divide-line rounded-[20px] border border-line shadow-[0_6px_20px_rgba(0,0,0,0.06)] [&>li]:mx-4 [&>li]:px-0">
            {view.meds.map((m) => (
              <li key={m.name} className="flex items-center gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{m.name}</p>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {m.schedule},{" "}
                    <span className={m.tone === "alert" ? "font-semibold text-coral" : m.tone === "ok" ? "font-semibold text-ok" : ""}>{m.note}</span>
                  </p>
                </div>
                {m.refill && (
                  <button type="button" onClick={onRefill} className="flex min-h-11 shrink-0 items-center rounded-full bg-ink px-[18px] text-sm font-semibold text-white">Refill</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Upcoming */}
        <section aria-labelledby="h-appt" className="pt-10">
          <h2 id="h-appt" className={`${H2} mb-3`}>Upcoming</h2>
          <div className="flex flex-col gap-3">
            {view.appts.map((a) => (
              <article key={a.who} className="flex items-center gap-4 rounded-[18px] border border-line p-4">
                <div className="w-[52px] shrink-0 rounded-xl bg-soft py-1.5 text-center" aria-hidden>
                  <p className="text-[11px] font-bold tracking-[0.5px] text-coral">{a.mon}</p>
                  <p className="text-xl font-bold leading-tight">{a.day}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{a.who}</p>
                  <p className="mt-1 text-[13px] text-ink-2">{a.what}</p>
                </div>
                {a.chip && (
                  <button type="button" onClick={() => onAction(a.chip!.action)}
                    className="-my-2 flex min-h-11 items-center whitespace-nowrap">
                    <span className="rounded-full bg-teal-tint px-2.5 py-1 text-xs font-bold text-teal-ink">{a.chip.label}</span>
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* What CareAgent did */}
        <section className="pt-10">
          <div className="rounded-[20px] bg-soft px-4 py-1">
            <button type="button" onClick={() => setLogOpen(!logOpen)} aria-expanded={logOpen} aria-controls="activity-log"
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">What CareAgent did</span>
                {!logOpen && <span className="mt-1 block truncate text-[13px] text-ink-2">{activitySummary(view.activity)}</span>}
              </span>
              <ChevronDown aria-hidden className={`size-[18px] transition-transform ${logOpen ? "rotate-180" : ""}`} strokeWidth={2.2} />
            </button>
            {logOpen && (
              <ul id="activity-log" className="pb-3">
                {view.activity.map((it) => (
                  <li key={it.title + it.when} className="border-t border-[#E4E4E4] py-3">
                    <span className="block text-sm font-semibold">{it.title}</span>
                    <span className="mt-1 block text-xs text-ink-2">{it.when}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Quick call */}
        <section aria-labelledby="h-call" className="pt-10">
          <h2 id="h-call" className={`${H2} mb-3`}>Quick call</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { who: "Dad", what: "Mobile", tel: DAD.phone },
              { who: DR_LEE.short, what: "Office", tel: DR_LEE.phone },
              { who: "Walgreens", what: "Pharmacy", tel: PHARMACY.phone },
            ].map((c) => (
              <a key={c.who} href={`tel:${c.tel}`} aria-label={`Call ${c.who}`}
                className="flex flex-col items-center gap-1 rounded-[18px] border border-line px-2 py-4 hover:bg-soft">
                <span className="text-[15px] font-bold">{c.who}</span>
                <span className="text-xs text-ink-2">{c.what}</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* Message CareAgent (pinned) */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-b from-white/0 via-white to-white px-4 pb-6 pt-3">
        <AskBox placeholder="Message CareAgent" onSend={onMessage} floating />
      </div>
    </div>
  );
}

export function UrgentTakeover({ onOkay }: { onOkay: () => void }) {
  return (
    <main role="alertdialog" aria-labelledby="em-h" aria-describedby="em-d" className="flex min-h-svh flex-col bg-[#9E2215] px-5 py-7 text-white">
      <p className="text-[13px] font-bold text-[#FFE1DA]">Urgent alert at 6:42 PM</p>
      <div aria-hidden className="mt-14 flex size-[76px] items-center justify-center rounded-full bg-white/15">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4 2.5 20h19Z" /><path d="M12 10v4M12 17v.01" /></svg>
      </div>
      <h1 id="em-h" className="mt-6 text-[34px] font-bold leading-[1.1] tracking-[-0.8px]">Dad may have fallen</h1>
      <p id="em-d" className="mt-3 text-[17px] leading-[1.45] text-[#FFE1DA]">His Apple Watch detected a hard fall and no movement for 2 minutes. He didn&apos;t respond to the watch.</p>
      <div className="mt-5 rounded-2xl bg-black/20 px-4 py-3.5 text-sm leading-normal">
        <p className="font-bold">{DAD.address}</p>
        <p className="mt-0.5 text-[#FFE1DA]">{DAD.allergy}. {DAD.meds}.</p>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-3">
        <a href="tel:911" className="flex min-h-16 items-center justify-center rounded-[18px] bg-white text-xl font-bold text-[#9E2215]">Call 911</a>
        <a href={`tel:${DAD.phone}`} className="flex min-h-[60px] items-center justify-center rounded-[18px] border-2 border-white text-lg font-bold">Call Dad</a>
        <PrimaryButton onClick={onOkay} className="bg-transparent text-[15px] font-semibold text-[#FFE1DA] underline hover:opacity-100">He&apos;s okay, I talked to him</PrimaryButton>
      </div>
    </main>
  );
}
