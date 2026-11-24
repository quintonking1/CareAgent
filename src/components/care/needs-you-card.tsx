"use client";

import type { CardAction, Fulfillment, NeedsYouCardData } from "@/lib/care-demo";
import { PHARMACY } from "@/lib/care-demo";
import { DoneDot, PrimaryButton, ProgressSteps, RadioRow, SecondaryButton, Spinner, TodoDot } from "./ui";

const card = "rounded-[20px] border border-line bg-white p-4 shadow-card";

// Needs you card. Kinds: approval (title, one line, primary + Not now), progress (the agent is working),
// refill (approve a Walgreens refill in place) and track (an order on its way).
export function NeedsYouCard({ data, onAction, fulfillment, onFulfillment, onApproveRefill }: {
  data: NeedsYouCardData;
  onAction: (a: CardAction) => void;
  fulfillment: Fulfillment;
  onFulfillment: (f: Fulfillment) => void;
  onApproveRefill: () => void;
}) {
  if (data.kind === "approval") {
    return (
      <article className={card}>
        <h3 className="text-lg font-bold leading-tight">{data.title}</h3>
        <p className="mt-1 text-sm leading-snug text-ink-2">{data.body}</p>
        <div className="mt-4 flex gap-2">
          <PrimaryButton className="flex-1" onClick={() => onAction(data.primary.action)}>{data.primary.label}</PrimaryButton>
          {data.secondary && <SecondaryButton className="flex-1" onClick={() => onAction(data.secondary!.action)}>{data.secondary.label}</SecondaryButton>}
        </div>
      </article>
    );
  }

  if (data.kind === "progress") {
    return (
      <button type="button" onClick={() => onAction(data.action)} className={`${card} block w-full text-left`} aria-label={`${data.title}. Open to see progress`}>
        <h3 className="text-lg font-bold leading-tight">{data.title}</h3>
        <p className="mt-1 text-sm text-ink-2">{data.body}</p>
        <ProgressSteps steps={data.steps} className="mt-4" />
      </button>
    );
  }

  if (data.kind === "track") {
    return (
      <article className={card}>
        <h3 className="text-lg font-bold">{data.title}</h3>
        <ol className="mt-4 flex flex-col gap-4">
          {data.steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              {s.state === "done" ? <DoneDot /> : s.state === "work" ? <Spinner /> : <TodoDot />}
              <span>
                <span className={`block text-[15px] ${s.state === "work" ? "font-bold" : "font-medium"} ${s.state === "todo" ? "text-ink-2" : "text-ink"}`}>{s.label}</span>
                <span className="mt-1 block text-xs text-ink-2">{s.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </article>
    );
  }

  return (
    <article className={card}>
      <h3 className="text-lg font-bold">Refill Lisinopril 10 mg</h3>
      <RefillTiles className="mt-3" />
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold text-ink-body">How should Dad get it?</legend>
        <RadioRow name="card-get" checked={fulfillment === "pickup"} onChange={() => onFulfillment("pickup")} title="Pickup, ready Wed" sub={PHARMACY.name} />
        <RadioRow name="card-get" checked={fulfillment === "delivery"} onChange={() => onFulfillment("delivery")} title="Delivery, arrives Thu" sub="To Dad's home, free" />
      </fieldset>
      <PrimaryButton className="mt-4 w-full" onClick={onApproveRefill}>Approve refill</PrimaryButton>
      <p className="mt-3 text-center text-xs text-ink-2">Tapping Approve sends it to Walgreens.</p>
    </article>
  );
}

export function RefillTiles({ className, supply = 30 }: { className?: string; supply?: 30 | 90 }) {
  const tiles = [
    { v: "2", l: "refills left" },
    { v: supply === 30 ? "$4.00" : "$10.00", l: "copay" },
    { v: `${supply} day`, l: "supply" },
  ];
  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      {tiles.map((t) => (
        <div key={t.l} className="rounded-[14px] border border-line p-3">
          <p className="text-lg font-bold">{t.v}</p>
          <p className="mt-0.5 text-xs text-ink-2">{t.l}</p>
        </div>
      ))}
    </div>
  );
}
