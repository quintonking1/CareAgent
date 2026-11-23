import { getDb } from "@/db";
import { runAgent } from "@/agent/careagent";
import { hasModelKey } from "@/agent/llm";
import type { StreamEvent } from "@/lib/blocks";
import { getCurrentProfile } from "@/lib/profile";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Ask about this" and Message CareAgent on the home. Runs the agent in its read-only "ask" surface,
// with what the person is looking at as context, and streams NDJSON like /api/chat.
export async function POST(req: Request) {
  const { text, context } = (await req.json()) as { text?: string; context?: string };
  if (!text?.trim()) return Response.json({ error: "empty message" }, { status: 400 });
  if (!hasModelKey()) return Response.json({ error: "offline" }, { status: 503 });

  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer } = await getViewer(db, profile.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent({
          db, careProfileId: profile.id, surface: { kind: "ask", context: context?.slice(0, 2000) },
          input: { kind: "message", userId: viewer.id, text: text.trim().slice(0, 1000) }, onEvent: send,
        });
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
