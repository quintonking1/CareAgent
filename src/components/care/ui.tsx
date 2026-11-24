"use client";

import { ArrowUp, Check, Sparkle } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/care-demo";

// Small building blocks for the phone-first home. Colors come from the care tokens in globals.css.

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className, size = "md", ...p }: BtnProps & { size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        "flex items-center justify-center rounded-xl bg-ink px-3 text-center font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50",
        size === "lg" ? "min-h-[52px] rounded-[14px] text-base font-bold" : "min-h-12 text-[15px]",
        className,
      )}
    />
  );
}

export function SecondaryButton({ className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cn("flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-white px-3 text-center text-[15px] font-semibold text-ink hover:bg-soft", className)}
    />
  );
}

export function TextButton({ className, ...p }: BtnProps) {
  return <button type="button" {...p} className={cn("inline-flex min-h-11 items-center justify-center text-[15px] font-semibold text-ink underline", className)} />;
}

export function Chip({ className, active, ...p }: BtnProps & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...p}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold disabled:opacity-50",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:bg-soft",
        className,
      )}
    />
  );
}

export function AgentMark({ className }: { className?: string }) {
  return <Sparkle aria-hidden className={cn("size-[18px] text-teal", className)} strokeWidth={2.2} />;
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-[10px] bg-teal text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 7.5 6.3Z" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-[-0.3px]">CareAgent</span>
    </div>
  );
}

export function DoneDot() {
  return (
    <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-teal text-white">
      <Check className="size-3" strokeWidth={3.4} />
    </span>
  );
}

export function Spinner() {
  return <span aria-hidden className="ca-spin size-[22px] shrink-0 rounded-full border-[2.5px] border-teal-ring border-t-teal" />;
}

export function TodoDot() {
  return <span aria-hidden className="size-[22px] shrink-0 rounded-full border-2 border-line-strong" />;
}

// The agent's work: a teal check when done, a spinner while in progress.
export function ProgressSteps({ steps, className }: { steps: Step[]; className?: string }) {
  const current = steps.find((s) => s.state === "work");
  return (
    <div className={className}>
      <ul className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm leading-snug">
            {s.state === "done" ? <DoneDot /> : s.state === "work" ? <Spinner /> : <TodoDot />}
            <span className={cn(s.state === "work" ? "font-semibold text-ink" : s.state === "todo" ? "text-ink-2" : "text-ink-body")}>{s.label}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status">{current ? `Working: ${current.label}` : "Done"}</p>
    </div>
  );
}

export function Sparkline({ points, color, height = 36, className }: { points: number[]; color: string; height?: number; className?: string }) {
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const pts = points.map((v, i) => `${((i / (points.length - 1)) * 118 + 1).toFixed(1)},${(33 - ((v - min) / span) * 30).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 120 36" width="100%" height={height} preserveAspectRatio="none" aria-hidden className={className}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// The pill-shaped ask box used in sheets and pinned at the bottom of the home.
export function AskBox({ placeholder, onSend, disabled, floating, autoFocus }: {
  placeholder: string;
  onSend: (text: string) => void;
  disabled?: boolean;
  floating?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || disabled) return;
        onSend(t);
        setText("");
      }}
      className={cn("flex items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pl-[18px] pr-1.5", floating && "shadow-float")}
    >
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <input
        id={id}
        type="text"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2"
      />
      <button type="submit" aria-label="Send" disabled={disabled} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal text-white disabled:opacity-50">
        <ArrowUp className="size-[18px]" strokeWidth={2.4} />
      </button>
    </form>
  );
}

export function UserBubble({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[80%] self-end rounded-[18px_18px_4px_18px] bg-ink px-3.5 py-2.5 text-[15px] leading-snug text-white">{children}</div>;
}

export function RadioRow({ name, checked, onChange, title, sub }: { name: string; checked: boolean; onChange: () => void; title: string; sub: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-4", checked ? "border-2 border-ink" : "border border-line-strong")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-5 accent-ink" />
      <span className="flex-1">
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-2">{sub}</span>
      </span>
    </label>
  );
}
