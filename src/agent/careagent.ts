import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import type { AgentTrace, Block, SerializedMessage, StreamEvent, TraceStep } from "@/lib/blocks";
import { getThread, postMessage, serializeMessage, type ChatMessage } from "@/lib/thread";
import { OpenAILLM, type ChatMsg, type LLM } from "./llm";
import { wellnessViolation } from "./safety";
import { systemPrompt } from "./system-prompt";
import { ToolError } from "@/lib/errors";
import { TOOL_DEFS, TOOLS, toolLabel, type ToolCtx } from "./tools";

// CareAgent: one agent, one system prompt, one tool loop. Every trigger (a chat message, a tapped
// button, an alert, a scheduled review) becomes input to this loop; the model picks the tools.

export const MAX_TOOL_CALLS = 15;
const HISTORY_MESSAGES = 30;

export type AgentInput =
  | { kind: "message"; userId: number; text: string }
  | { kind: "event"; text: string; actorId?: number };

export interface RunOptions {
  db: Db;
  careProfileId: number;
  input: AgentInput;
  llm?: LLM;
  onEvent?: (e: StreamEvent) => void;
}

function blockSummary(b: Block) {
  if (b.type === "alert") return `alert card #${b.alertId} (${b.label})`;
  if (b.type === "trend") return `${b.label.toLowerCase()} chart`;
  if (b.type === "slots") return `slot picker: ${b.options.map((o) => o.slotId).join(", ")}`;
  if (b.type === "approval") return `approval card #${b.approvalId} (${b.title})`;
  if (b.type === "appointment") return `appointment card #${b.appointmentId}`;
  return `suggested replies: ${b.options.join(" | ")}`;
}

function historyFor(db: Db, messages: ChatMessage[]): ChatMsg[] {
  const names = new Map(db.select().from(s.users).all().map((u) => [u.id, u.name]));
  return messages.map((m): ChatMsg => {
    if (m.role === "user") return { role: "user", content: `${names.get(m.authorId ?? -1) ?? "Family member"}: ${m.content}` };
    if (m.role === "event") return { role: "user", content: `[Automated event] ${m.content}` };
    const shown = m.blocks.length ? `\n[Shown in chat: ${m.blocks.map(blockSummary).join("; ")}]` : "";
    return { role: "assistant", content: (m.content || "(no text)") + shown };
  });
}

export async function runAgent({ db, careProfileId, input, llm, onEvent = () => {} }: RunOptions): Promise<{
  input: SerializedMessage;
  reply: SerializedMessage;
}> {
  const profile = db.select().from(s.careProfiles).where(eq(s.careProfiles.id, careProfileId)).get();
  if (!profile) throw new Error(`care profile ${careProfileId} not found`);

  const viewer = input.kind === "message"
    ? db.select({ name: s.users.name, role: s.memberships.role }).from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(eq(s.memberships.userId, input.userId)).get()
    : undefined;

  const saved = postMessage(db, input.kind === "message"
    ? { careProfileId, role: "user", authorId: input.userId, content: input.text }
    : { careProfileId, role: "event", content: input.text });
  const inputMsg = serializeMessage(saved, viewer?.name);
  onEvent({ type: "input", message: inputMsg });

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt(profile, viewer ?? { name: "the care circle", role: "primary_caregiver" }) },
    ...historyFor(db, getThread(db, careProfileId, HISTORY_MESSAGES)),
  ];

  const ctx: ToolCtx = { db, profile, blocks: [], actorId: input.kind === "message" ? input.userId : input.actorId };
  const steps: TraceStep[] = [];
  // Text the model writes before calling tools is a preamble: streamed live, replaced by the final answer.
  let text = "";
  let preamble = "";
  const started = Date.now();
  let error: string | undefined;
  let rewrote = false;

  try {
    llm ??= new OpenAILLM();
    for (;;) {
      const turn = await llm.turn(messages, TOOL_DEFS, (text) => onEvent({ type: "delta", text }));
      if (!turn.toolCalls.length) {
        text = turn.content.trim() || preamble;
        // Code-level wellness check on the final reply; one chance to rewrite.
        const violation = wellnessViolation(text);
        if (violation && !rewrote) {
          rewrote = true;
          text = preamble = "";
          onEvent({ type: "reset" });
          messages.push(
            { role: "assistant", content: turn.content },
            { role: "user", content: `[Automated check] Your reply ${violation}. Rewrite it in wellness language: describe the readings, no diagnoses or dosing advice.` },
          );
          continue;
        }
        if (violation) throw new Error(`reply still ${violation} after a rewrite`);
        break;
      }

      if (turn.content.trim()) {
        preamble = turn.content.trim();
        onEvent({ type: "reset" });
      }
      messages.push({
        role: "assistant",
        content: turn.content || null,
        tool_calls: turn.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
      });

      for (const call of turn.toolCalls) {
        if (steps.length >= MAX_TOOL_CALLS) throw new Error(`stopped after ${MAX_TOOL_CALLS} tool calls`);
        let args: Record<string, unknown> = {};
        let result: unknown;
        let ok = true;
        try {
          args = JSON.parse(call.arguments || "{}");
          const tool = TOOLS[call.name];
          if (!tool) throw new ToolError(`unknown tool ${call.name}`);
          const before = ctx.blocks.length;
          result = await tool.run(args, ctx);
          for (const block of ctx.blocks.slice(before)) onEvent({ type: "block", block });
        } catch (e) {
          ok = false;
          if (!(e instanceof ToolError) && !(e instanceof SyntaxError)) throw e;
          result = { error: e.message };
        }
        const step = { tool: call.name, label: toolLabel(call.name, args), ok };
        steps.push(step);
        onEvent({ type: "step", step });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const trace: AgentTrace = { steps, ms: Date.now() - started, ...(error ? { error } : {}) };
  const content = error
    ? [text || preamble, `I couldn't finish this (${error}). Please try again.`].filter(Boolean).join("\n\n")
    : text;
  const reply = serializeMessage(postMessage(db, { careProfileId, role: "assistant", content, blocks: ctx.blocks, trace }));
  if (error) onEvent({ type: "error", text: error });
  onEvent({ type: "done", message: reply });
  return { input: inputMsg, reply };
}
