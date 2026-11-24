"use client";

import { FlaskConical, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEMO_STEPS } from "@/lib/care-demo";

// Dev-only control for jumping to any step of the three flows. Not part of the product design.
export function DemoSwitcher({ current, onJump, online }: { current: string; onJump: (id: string) => void; online: boolean }) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(DEMO_STEPS.map((s) => s.group))];
  return (
    <div className="absolute right-3 top-3 z-30 font-care">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="demo-steps"
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-white/90 px-3 text-[13px] font-semibold text-ink-2 shadow-sm backdrop-blur">
        {open ? <X className="size-4" /> : <FlaskConical className="size-4" />} Demo
      </button>
      {open && (
        <nav id="demo-steps" aria-label="Demo steps" className="absolute right-0 mt-2 max-h-[75svh] w-64 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-card">
          <p className="px-2 pb-2 pt-1 text-xs text-ink-2">Agent {online ? "online" : "offline, using canned answers"}</p>
          {groups.map((g) => (
            <div key={g} className="pb-1">
              <p className="px-2 pb-1 pt-2 text-xs font-bold text-ink-body">{g}</p>
              {DEMO_STEPS.filter((s) => s.group === g).map((s) => (
                <button key={s.id} type="button" onClick={() => { onJump(s.id); setOpen(false); }} aria-current={s.id === current ? "step" : undefined}
                  className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm ${s.id === current ? "bg-teal-tint font-semibold text-teal-ink" : "hover:bg-soft"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-1 border-t border-line pt-2">
            <button type="button" className="flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm hover:bg-soft"
              onClick={async () => {
                const res = await fetch("/api/care/reset", { method: "POST" });
                if (!res.ok) return toast.error("Couldn't reset the demo data.");
                onJump("home");
                setOpen(false);
                toast.success("Demo data reset.");
              }}>
              Reset demo data
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
