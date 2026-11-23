import type { ChatMsg, LLM, LLMTurn, ToolDef } from "@/agent/llm";

type Step = LLMTurn | ((messages: ChatMsg[]) => LLMTurn);

let callId = 0;
export const call = (name: string, args: Record<string, unknown> = {}) => ({
  id: `call_${++callId}`, name, arguments: JSON.stringify(args),
});
export const say = (content: string): LLMTurn => ({ content, toolCalls: [] });
export const use = (...toolCalls: ReturnType<typeof call>[]): LLMTurn => ({ content: "", toolCalls });

// Plays back a fixed script of model turns and records what the agent sent.
export class ScriptedLLM implements LLM {
  seen: ChatMsg[][] = [];
  toolsSeen: string[][] = [];
  constructor(private steps: Step[], private repeatLast = false) {}
  async turn(messages: ChatMsg[], tools: ToolDef[], onDelta?: (t: string) => void) {
    this.seen.push(structuredClone(messages));
    this.toolsSeen.push(tools.map((t) => t.function.name));
    const step = this.steps.length > 1 || !this.repeatLast ? this.steps.shift() : this.steps[0];
    if (!step) throw new Error("script exhausted");
    const turn = typeof step === "function" ? step(messages) : step;
    if (turn.content) onDelta?.(turn.content);
    return turn;
  }
}
