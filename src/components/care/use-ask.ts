"use client";

import { useCallback, useRef, useState } from "react";
import type { StreamEvent } from "@/lib/blocks";
import { cannedAnswer, type Step } from "@/lib/care-demo";

export interface AskTurn {
  id: number;
  question: string;
  answer: string;
  steps: Step[];
  pending: boolean;
  offline?: boolean;
}

// Sends a question to the agent's read-only "ask" surface with what the person is looking at,
// streaming its tool steps (shown as progress) and its answer. Falls back to a canned answer
// when the agent is offline (no OPENAI_API_KEY) or the request fails.
export function useAsk(context: string) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const nextId = useRef(1);
  const busy = turns.some((t) => t.pending);

  const update = (id: number, f: (t: AskTurn) => AskTurn) => setTurns((ts) => ts.map((t) => (t.id === id ? f(t) : t)));

  const ask = useCallback(async (question: string) => {
    const id = nextId.current++;
    setTurns((ts) => [...ts, { id, question, answer: "", steps: [{ label: "Looking at Dad's data", state: "work" }], pending: true }]);

    const fallback = () => update(id, (t) => ({ ...t, answer: cannedAnswer(question), steps: [], pending: false, offline: true }));
    try {
      const res = await fetch("/api/care/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: question, context }) });
      if (!res.ok || !res.body) return fallback();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let live = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as StreamEvent;
          if (e.type === "step") {
            update(id, (t) => ({ ...t, steps: [...t.steps.filter((s) => s.state === "done"), { label: e.step.label, state: "done" }, { label: "Writing an answer", state: "work" }] }));
          } else if (e.type === "delta") {
            live += e.text;
            update(id, (t) => ({ ...t, answer: live }));
          } else if (e.type === "reset") {
            live = "";
          } else if (e.type === "done") {
            finished = true;
            update(id, (t) => ({ ...t, answer: e.message.content, steps: t.steps.filter((s) => s.state === "done"), pending: false }));
          } else if (e.type === "error" && !finished) {
            return fallback();
          }
        }
      }
      if (!finished) fallback();
    } catch {
      fallback();
    }
  }, [context]);

  return { turns, ask, busy, reset: () => setTurns([]) };
}
