"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DR_LEE, INITIAL_STATE, PHARMACY, SLOTS, VITALS, homeView, stepById,
  type CardAction, type CareState, type Overlay, type Slot, type Vital,
} from "@/lib/care-demo";
import { DemoSwitcher } from "./demo-switcher";
import { AskSheet, BookingSheet, HrChartSheet, HrMonthSheet, RefillSheet } from "./flows";
import { Home, UrgentTakeover } from "./home";
import { BookedPage, BriefPage, BriefReadyPage, BriefShowPage, RefillSentPage, VisitNotesPage } from "./pages";

function fromStep(id: string | null) {
  const step = stepById(id) ?? stepById("home")!;
  return { state: { ...INITIAL_STATE, ...step.state }, overlay: step.overlay };
}

// The phone-first CareAgent app: one state object drives the home, plus whichever sheet or
// full-screen page is open on top of it. ?step=<id> (or the Demo menu) jumps to any step.
export function CareApp({ online }: { online: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => fromStep(params.get("step")), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<CareState>(initial.state);
  const [overlay, setOverlay] = useState<Overlay>(initial.overlay);
  const [stepId, setStepId] = useState(params.get("step") ?? "home");
  const view = homeView(state);
  const patch = useCallback((p: Partial<CareState>) => setState((s) => ({ ...s, ...p })), []);
  const log = (title: string, when = "Just now, you approved") => setState((s) => ({ ...s, activity: [{ title, when }, ...s.activity] }));
  const close = () => setOverlay({ kind: "none" });
  const slot = state.booked ?? SLOTS[0];

  // Closing a sheet mid-task parks it in Needs you; the agent finishes there a moment later.
  const parkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(parkTimer.current), []);
  function closeBooking(phase: "working" | "times") {
    patch({ bookingParked: phase });
    if (phase === "working") parkTimer.current = setTimeout(() => patch({ bookingParked: "times" }), 2500);
    close();
  }
  function closeRefill(phase: "working" | "approve") {
    patch({ refillParked: phase });
    if (phase === "working") parkTimer.current = setTimeout(() => patch({ refillParked: "approve" }), 2500);
    close();
  }
  const openBooking = () => setOverlay({ kind: "booking", phase: state.bookingParked === "times" ? "times" : "working" });
  const openRefill = () => setOverlay({ kind: "refill", phase: state.refillParked === "approve" ? "approve" : "working" });

  function jump(id: string) {
    const next = fromStep(id);
    clearTimeout(parkTimer.current);
    setState(next.state);
    setOverlay(next.overlay);
    setStepId(id);
    router.replace(id === "home" ? "/" : `/?step=${id}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  async function book(s: Slot) {
    const res = await fetch("/api/care/zocdoc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: DR_LEE.providerId, start_time: s.startTime, visit_type: "in_person" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(`Couldn't book: ${body.error ?? "Zocdoc didn't respond"}`); return; }
    patch({ booked: s, bookingParked: null });
    log(`Booked Dr. Lee for ${s.day}${state.bookingAlsoDad ? " and added it to both calendars" : " and added it to your calendar"}`);
    setOverlay({ kind: "page", page: "booked" });
    window.scrollTo({ top: 0 });
  }

  async function approveRefill() {
    const res = await fetch("/api/care/walgreens", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rxNumber: PHARMACY.rxNumber, fulfillment: state.refillFulfillment, supplyDays: state.refillSupply }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.callback !== "done") { toast.error(`Walgreens didn't take the refill: ${body.error ?? body.callback ?? "no response"}`); return; }
    patch({ refill: "sent", refillParked: null });
    log("Sent Lisinopril refill to Walgreens");
    setOverlay({ kind: "page", page: "refill-sent" });
    window.scrollTo({ top: 0 });
  }

  function onAction(a: CardAction) {
    switch (a) {
      case "open-booking": return openBooking();
      case "snooze-booking": return patch({ bookingSnoozed: true, bookingParked: null });
      case "open-refill": return openRefill();
      case "snooze-refill": return patch({ refillSnoozed: true, refillParked: null });
      case "review-brief": return setOverlay({ kind: "page", page: state.brief === "marked" ? "brief-ready" : "brief" });
      case "snooze-brief": return toast("I'll remind you about the brief in the morning.");
      case "picked-up": patch({ refill: "picked_up" }); return log("Lisinopril picked up", "Just now");
      case "directions": window.open("https://maps.google.com/?q=Walgreens+Folsom+Blvd+Sacramento", "_blank", "noopener"); return;
      case "open-notes": return setOverlay({ kind: "page", page: "notes" });
    }
  }

  function askVital(v: Vital) {
    if (v.id === "hr") return setOverlay({ kind: "chart" });
    setOverlay({ kind: "ask", title: v.label, context: v.context, first: `How is Dad's ${v.label.toLowerCase()} this week?` });
  }

  const homeContext = `The CareAgent home. Headline: ${view.h1}. ${view.sub} ${view.status ?? ""} Needs you: ${view.cards.map((c) => ("title" in c ? c.title : "Refill Lisinopril")).join("; ") || "nothing"}. Vitals: ${VITALS.map((v) => `${v.label} ${v.value} ${v.unit} (${v.usual})`).join(", ")}.`;

  let screen: React.ReactNode;
  if (state.emergency) {
    screen = <UrgentTakeover onOkay={() => { patch({ emergency: false }); log("Fall alert closed, you talked to Dad", "Just now"); }} />;
  } else if (overlay.kind === "page") {
    const p = overlay.page;
    const toHome = () => { close(); window.scrollTo({ top: 0 }); };
    screen =
      p === "booked" ? <BookedPage slot={slot} alsoDad={state.bookingAlsoDad} onDone={toHome}
        onChange={() => { patch({ booked: null }); setOverlay({ kind: "booking", phase: "times" }); }} />
      : p === "refill-sent" ? <RefillSentPage fulfillment={state.refillFulfillment} supply={state.refillSupply}
        onDone={() => { patch({ refill: "ready" }); toHome(); }} onChange={() => { patch({ refill: "due" }); setOverlay({ kind: "refill", phase: "approve" }); }} />
      : p === "brief" ? <BriefPage slot={slot} questions={state.briefQuestions} onQuestions={(q) => patch({ briefQuestions: q })} onBack={toHome}
        onReady={() => { patch({ brief: "marked" }); log("Prepared the brief for Dr. Lee", "Wed, Dec 2, 6:00 PM"); setOverlay({ kind: "page", page: "brief-ready" }); }} />
      : p === "brief-ready" ? <BriefReadyPage slot={slot} questionCount={state.briefQuestions.length} shared={state.briefShared}
        onShow={() => setOverlay({ kind: "page", page: "brief-show" })} onDone={toHome}
        onShare={() => { patch({ briefShared: true }); log("Shared the brief with Dr. Lee's office"); }} />
      : p === "brief-show" ? <BriefShowPage slot={slot} questions={state.briefQuestions} onClose={() => setOverlay({ kind: "page", page: "brief-ready" })} />
      : <VisitNotesPage onBack={toHome} onFindTimes={() => setOverlay({ kind: "booking", phase: "working" })}
        onSave={(rx) => { patch({ notesSaved: true, newRx: rx }); log("Saved notes from Dr. Lee's visit", "Just now"); toHome(); }} />;
  } else {
    screen = (
      <Home view={view} state={state} onAction={onAction} onAskVital={askVital} onAllCharts={() => setOverlay({ kind: "month" })}
        onMessage={(text) => setOverlay({ kind: "ask", title: "Home", context: homeContext, first: text })}
        onRefill={openRefill} onFulfillment={(f) => patch({ refillFulfillment: f })} onApproveRefill={approveRefill}
        onOpenNotes={() => setOverlay({ kind: "page", page: "notes" })} />
    );
  }

  return (
    <div className="font-care relative min-h-svh bg-white text-ink">
      <div className="mx-auto max-w-[430px]">{screen}</div>

      {!state.emergency && overlay.kind === "chart" && (
        <HrChartSheet onClose={close} onMonth={() => setOverlay({ kind: "month" })} onBook={() => setOverlay({ kind: "booking", phase: "working" })} />
      )}
      {!state.emergency && overlay.kind === "month" && (
        <HrMonthSheet onClose={close} onBack={() => setOverlay({ kind: "chart" })} onFindTime={() => setOverlay({ kind: "booking", phase: "working" })} />
      )}
      {!state.emergency && overlay.kind === "booking" && (
        <BookingSheet key="booking" phase={overlay.phase} onPhase={(p) => setOverlay({ kind: "booking", phase: p })} onClose={() => closeBooking(overlay.phase)}
          onBook={book} alsoDad={state.bookingAlsoDad} onAlsoDad={(v) => patch({ bookingAlsoDad: v })} />
      )}
      {!state.emergency && overlay.kind === "refill" && (
        <RefillSheet key="refill" phase={overlay.phase} onPhase={(p) => setOverlay({ kind: "refill", phase: p })} onClose={() => closeRefill(overlay.phase)}
          fulfillment={state.refillFulfillment} onFulfillment={(f) => patch({ refillFulfillment: f })}
          supply={state.refillSupply} onSupply={(s) => patch({ refillSupply: s })} onApprove={approveRefill} />
      )}
      {!state.emergency && overlay.kind === "ask" && (
        <AskSheet key={overlay.title + overlay.first} title={overlay.title} context={overlay.context} first={overlay.first} onClose={close} />
      )}

      <DemoSwitcher current={stepId} onJump={jump} online={online} />
    </div>
  );
}
