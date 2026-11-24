"use client";

import { ChevronLeft, X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/care-demo";
import type { AskTurn } from "./use-ask";
import { AgentMark, AskBox, Chip, PrimaryButton, ProgressSteps, UserBubble } from "./ui";

// The shared bottom sheet (Flows 1 and 3, and every "Ask about this"). Slides up over the dimmed
// home; swipe the handle down, tap outside, press Esc or tap X to dismiss. Built on Radix
// Dialog, so it gets role="dialog", focus trapping and Esc for free.
export function AgentSheet({ open, onClose, title, via, onBack, tall, footer, children, scrollKey }: {
  open: boolean;
  onClose: () => void;
  title: string;
  via?: string;
  onBack?: () => void;
  tall?: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
  scrollKey?: unknown; // changes when new content arrives, to keep the latest in view
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = body.current;
    if (el && scrollKey) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollKey]);

  const dragProps = {
    onPointerDown: (e: React.PointerEvent) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); },
    onPointerMove: (e: React.PointerEvent) => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); },
    onPointerUp: () => { if (drag > 110) onClose(); start.current = null; setDrag(0); },
    onPointerCancel: () => { start.current = null; setDrag(0); },
  };

  return (
    <SheetPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <SheetPrimitive.Content
          aria-describedby={undefined}
          // Close on a tap outside, a swipe, Esc or X; not when focus merely moves (e.g. the page loading behind it).
          onFocusOutside={(e) => e.preventDefault()}
          style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
          className={cn(
            "font-care fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[430px] flex-col rounded-t-[28px] bg-white text-ink shadow-sheet outline-none transition-transform",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-300 data-[state=closed]:duration-200",
            tall ? "top-6" : "top-16",
          )}
        >
          <div {...dragProps} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5" aria-hidden>
            <span className="h-[5px] w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-1">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Back" className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-full">
                <ChevronLeft className="size-5" strokeWidth={2.4} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <SheetPrimitive.Title className="flex items-center gap-2 text-lg font-bold">
                {!onBack && <AgentMark />}
                {title}
              </SheetPrimitive.Title>
              {via && <p className={cn("mt-0.5 text-[13px] text-ink-2", !onBack && "ml-[26px]")}>{via}</p>}
            </div>
            <SheetPrimitive.Close aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft">
              <X className="size-4" strokeWidth={2.4} />
            </SheetPrimitive.Close>
          </div>
          <div ref={body} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-2 pt-5">{children}</div>
          <div className="flex shrink-0 flex-col gap-3 border-t border-[#F0F0F0] px-4 pb-6 pt-3">{footer}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

export function AgentProgress({ steps }: { steps: Step[] }) {
  return <ProgressSteps steps={steps} className="rounded-[18px] bg-soft p-4" />;
}

export function AgentMessage({ children }: { children: React.ReactNode }) {
  return <div className="text-[15px] leading-normal [&>p+p]:mt-2">{children}</div>;
}

export function NotADoctor() {
  return <p className="text-xs text-ink-2">I&apos;m not a doctor. If he has chest pain or shortness of breath, call 911.</p>;
}

export interface ChipSpec { label: string; onClick: () => void; active?: boolean }

export function ChipRow({ chips, disabled }: { chips: ChipSpec[]; disabled?: boolean }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {chips.map((c) => <Chip key={c.label} onClick={c.onClick} active={c.active} disabled={disabled}>{c.label}</Chip>)}
    </div>
  );
}

// Questions asked in this sheet and the agent's answers, with its steps while it works.
export function AskThread({ turns }: { turns: AskTurn[] }) {
  return (
    <>
      {turns.map((t) => (
        <div key={t.id} className="flex flex-col gap-3">
          <UserBubble>{t.question}</UserBubble>
          {t.pending && !t.answer && <AgentProgress steps={t.steps} />}
          {t.answer && <AgentMessage><p className="whitespace-pre-line">{t.answer}</p></AgentMessage>}
        </div>
      ))}
    </>
  );
}

// Footer: the approval button, the consent line under it, and the ask box.
export function SheetFooter({ action, placeholder, onAsk, busy }: {
  action?: { label: string; note?: string; onClick: () => void; disabled?: boolean };
  placeholder: string;
  onAsk: (q: string) => void;
  busy?: boolean;
}) {
  return (
    <>
      {action && (
        <div>
          <PrimaryButton size="lg" className="w-full" onClick={action.onClick} disabled={action.disabled}>{action.label}</PrimaryButton>
          {action.note && <p className="mt-2 text-center text-xs text-ink-2">{action.note}</p>}
        </div>
      )}
      <AskBox placeholder={placeholder} onSend={onAsk} disabled={busy} />
    </>
  );
}
