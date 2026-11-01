import { getDb } from "@/db";
import { runAgent } from "@/agent/careagent";
import { hasModelKey } from "@/agent/llm";
import type { StreamEvent } from "@/lib/blocks";
import { getCurrentProfile } from "@/lib/profile";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs one agent turn for a chat message and streams its progress as NDJSON (one StreamEvent per line).
export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return Response.json({ error: "empty message" }, { status: 400 });
  if (!hasModelKey()) return Response.json({ error: "Add OPENAI_API_KEY to .env to talk to CareAgent." }, { status: 503 });

  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer } = await getViewer(db, profile.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent({ db, careProfileId: profile.id, input: { kind: "message", userId: viewer.id, text: text.trim() }, onEvent: send });
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
