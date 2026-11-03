"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Block, SerializedMessage, StreamEvent, TraceStep } from "@/lib/blocks";
import { AssistantMessage, EventMessage, UserMessage } from "./message";

interface Pending {
  text: string;
  blocks: Block[];
  steps: TraceStep[];
}

export function Chat({ initialMessages, viewerName, parentName, suggestions, online }: {
  initialMessages: SerializedMessage[];
  viewerName: string;
  parentName: string;
  suggestions: string[];
  online: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = pending !== null;
  const first = parentName.split(" ")[0];

  // Server-side changes (alerts posted by the agent, viewer switch) arrive as fresh props.
  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 280) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, []);

  function autosize() {
    const t = inputRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
  }

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (!online) {
      toast.error("CareAgent is offline. Add OPENAI_API_KEY to .env and restart.");
      return;
    }
    setInput("");
    requestAnimationFrame(autosize);
    run("/api/chat", { text });
  }

  function decide(approvalId: number, decision: "approve" | "decline") {
    if (busy) return;
    // Show the decision right away; the server confirms on refresh.
    setMessages((ms) => ms.map((m) => ({
      ...m,
      blocks: m.blocks.map((b) => (b.type === "approval" && b.approvalId === approvalId
        ? { ...b, decisions: [...b.decisions, { name: viewerName, role: "", decision }] } : b)),
    })));
    run("/api/approvals", { approvalId, decision });
  }

  // Streams one agent run (a chat message or an approval decision) into the thread.
  async function run(url: string, body: unknown) {
    setPending({ text: "", blocks: [], steps: [] });
    let gotDone = false;

    const handle = (e: StreamEvent) => {
      if (e.type === "input") setMessages((m) => [...m, e.message]);
      else if (e.type === "delta") setPending((p) => p && { ...p, text: p.text + e.text });
      else if (e.type === "reset") setPending((p) => p && { ...p, text: "" });
      else if (e.type === "step") setPending((p) => p && { ...p, steps: [...p.steps, e.step] });
      else if (e.type === "block") setPending((p) => p && { ...p, blocks: [...p.blocks, e.block] });
      else if (e.type === "error") toast.error(e.text);
      else if (e.type === "settled") gotDone = true;
      else if (e.type === "done") {
        gotDone = true;
        setMessages((m) => [...m, e.message]);
      }
    };

    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.trim()) handle(JSON.parse(line));
        }
      }
      if (!gotDone) throw new Error("the connection closed early");
    } catch (e) {
      toast.error(`Couldn't reach CareAgent: ${e instanceof Error ? e.message : e}`);
    } finally {
      setPending(null);
      router.refresh(); // live card state, sidebar badge, Home status line
    }
  }

  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant");
  const empty = messages.length === 0 && !busy;

  const composer = (
    <form className="mx-auto w-full max-w-3xl" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="flex flex-col gap-1.5 rounded-[28px] border bg-card p-2.5 pl-4 shadow-[0_2px_12px_oklch(0.3_0.02_50/0.06)]">
        <Textarea
          ref={inputRef}
          rows={1}
          value={input}
          placeholder={`Ask about ${first}`}
          onChange={(e) => { setInput(e.target.value); autosize(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          }}
          className="max-h-[200px] min-h-0 resize-none border-0 bg-transparent p-1.5 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex justify-end">
          <Button type="submit" size="icon" className="size-9 rounded-full" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp className="size-5" />
          </Button>
        </div>
      </div>
    </form>
  );

  if (empty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        <h2 className="text-balance text-center font-heading text-3xl font-normal tracking-tight sm:text-4xl">How can I help with {first} today, {viewerName.split(" ")[0]}?</h2>
        {composer}
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Button key={s} variant="outline" className="h-auto rounded-full border-transparent bg-chip px-4 py-2 font-normal text-foreground/80 shadow-[0_1px_2px_oklch(0.3_0.02_50/0.06)] hover:bg-card hover:text-foreground" onClick={() => send(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-6 pt-3 sm:px-6">
          {messages.map((m, i) => {
            if (m.role === "user") return <UserMessage key={m.id} message={m} showAuthor={m.authorName !== viewerName} />;
            if (m.role === "event") return <EventMessage key={m.id} message={m} />;
            return (
              <AssistantMessage key={m.id} content={m.content} blocks={m.blocks} steps={m.trace?.steps ?? []} ms={m.trace?.ms}
                error={m.trace?.error} running={false} interactive={i === lastAssistant && !busy} idle={!busy} onSend={send} onDecide={decide} />
            );
          })}
          {pending && (
            <AssistantMessage content={pending.text} blocks={pending.blocks} steps={pending.steps} running interactive={false} idle={false} onSend={send} onDecide={decide} />
          )}
        </div>
      </div>
      <div className="shrink-0 bg-background px-3 pb-2 sm:px-6">
        {composer}
        <p className="pt-2 text-center text-xs text-muted-foreground">
          CareAgent can make mistakes and doesn&apos;t give medical advice. In an emergency, call 911.
        </p>
      </div>
    </>
  );
}
