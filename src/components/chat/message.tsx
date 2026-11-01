"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Check, ChevronRight, Copy, ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Block, SerializedMessage, TraceStep } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { BlockView, type Decide } from "./blocks";

type Send = (text: string) => void;

export function UserMessage({ message, showAuthor }: { message: SerializedMessage; showAuthor: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {showAuthor && <span className="px-2 text-xs text-muted-foreground">{message.authorName}</span>}
      {/* Tapped slots carry a machine id for the agent; hide it from people. */}
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-muted px-4 py-2.5 sm:max-w-[70%]">
        {message.content.replace(/\s*\(slot [^)]+\)/, "")}
      </div>
    </div>
  );
}

// Automated triggers that woke the agent (alerts, scheduled reviews).
export function EventMessage({ message }: { message: SerializedMessage }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <Zap className="size-3.5" />
      <span>{message.content}</span>
    </div>
  );
}

export function Trace({ steps, ms, running, error }: { steps: TraceStep[]; ms?: number; running: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const current = steps.at(-1)?.label ?? "Thinking";
  if (!running && !steps.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground">
        {running ? (
          <span className="shimmer">{current}…</span>
        ) : (
          <span>
            Worked for {Math.max(1, Math.round((ms ?? 0) / 1000))}s · {steps.length} step{steps.length === 1 ? "" : "s"}
            {error && <span className="text-destructive"> · stopped</span>}
          </span>
        )}
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="ml-1.5 mt-2.5 space-y-2 border-l-2 pl-4 text-sm text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              {s.ok ? <Check className="size-3.5 text-emerald-600" /> : <AlertTriangle className="size-3.5 text-amber-600" />}
              <span>{s.label}</span>
              <code className="text-xs opacity-60">{s.tool}</code>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Actions({ text }: { text: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const icon = "size-8 text-muted-foreground hover:text-foreground";
  return (
    <div className="-ml-2 flex">
      <Button variant="ghost" size="icon" className={icon} aria-label="Copy"
        onClick={() => navigator.clipboard?.writeText(text).then(() => toast("Copied"))}>
        <Copy />
      </Button>
      <Button variant="ghost" size="icon" className={cn(icon, rating === "up" && "text-foreground")} aria-label="Good response"
        onClick={() => setRating(rating === "up" ? null : "up")}>
        <ThumbsUp />
      </Button>
      <Button variant="ghost" size="icon" className={cn(icon, rating === "down" && "text-foreground")} aria-label="Bad response"
        onClick={() => setRating(rating === "down" ? null : "down")}>
        <ThumbsDown />
      </Button>
    </div>
  );
}

export function AssistantMessage({ content, blocks, steps, ms, error, running, interactive, idle, onSend, onDecide }: {
  content: string;
  blocks: Block[];
  steps: TraceStep[];
  ms?: number;
  error?: string;
  running: boolean;
  interactive: boolean;
  idle: boolean;
  onSend: Send;
  onDecide: Decide;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <Trace steps={steps} ms={ms} running={running} error={error} />
      {running && !content && !steps.length && <div className="size-3 animate-pulse rounded-full bg-foreground" />}
      {content && (
        <div className="prose-chat animate-in fade-in-0 duration-300">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} onSend={onSend} onDecide={onDecide} interactive={interactive && !running} idle={idle && !running} />
      ))}
      {!running && content && <Actions text={content} />}
    </div>
  );
}
