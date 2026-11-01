import { getDb } from "@/db";
import { handleDecision } from "@/agent/events";
import type { StreamEvent } from "@/lib/blocks";
import { getCurrentProfile } from "@/lib/profile";
import { getApproval } from "@/lib/approvals";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Records the viewer's Approve / Decline and streams the agent carrying it out (NDJSON, like /api/chat).
export async function POST(req: Request) {
  const { approvalId, decision } = (await req.json()) as { approvalId?: number; decision?: string };
  if (decision !== "approve" && decision !== "decline") return Response.json({ error: "bad decision" }, { status: 400 });

  const db = getDb();
  const profile = getCurrentProfile(db);
  const approval = getApproval(db, Number(approvalId));
  if (!approval || approval.careProfileId !== profile.id) return Response.json({ error: "approval not found" }, { status: 404 });
  const { viewer } = await getViewer(db, profile.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const res = await handleDecision(db, approval.id, viewer.id, decision, { onEvent: send });
        if (!res.ran) send({ type: "settled" });
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
