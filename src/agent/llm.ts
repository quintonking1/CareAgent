import OpenAI from "openai";

export type ChatMsg = OpenAI.Chat.ChatCompletionMessageParam;
export type ToolDef = OpenAI.Chat.ChatCompletionTool;

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LLMTurn {
  content: string;
  toolCalls: ToolCall[];
}

// One model turn. Swappable so tests can script the model without network access.
export interface LLM {
  turn(messages: ChatMsg[], tools: ToolDef[], onDelta?: (text: string) => void): Promise<LLMTurn>;
}

export class OpenAILLM implements LLM {
  private client = new OpenAI();
  constructor(private model = process.env.OPENAI_MODEL || "gpt-4.1-mini") {}

  async turn(messages: ChatMsg[], tools: ToolDef[], onDelta?: (text: string) => void): Promise<LLMTurn> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      temperature: 0.3,
      stream: true,
    });
    let content = "";
    const calls: ToolCall[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        onDelta?.(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const call = (calls[tc.index] ??= { id: "", name: "", arguments: "" });
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.name += tc.function.name;
        if (tc.function?.arguments) call.arguments += tc.function.arguments;
      }
    }
    return { content, toolCalls: calls.filter(Boolean) };
  }
}

export const hasModelKey = () => Boolean(process.env.OPENAI_API_KEY);
