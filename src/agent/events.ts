import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { decideApproval } from "@/lib/approvals";
import type { StreamEvent } from "@/lib/blocks";
import { postMessage, alertBlock } from "@/lib/thread";
import { RULES, type Alert, type Evidence, type RuleId } from "@/rules/alerts";
import { runAgent } from "./careagent";
import { hasModelKey, type LLM } from "./llm";

// Wakes the agent for each new alert. Without a model key, posts the rule's own description
// so the demo still shows the alert.
export async function announceAlerts(db: Db, alerts: Alert[], llm?: LLM) {
  for (const alert of alerts) {
    const label = RULES[alert.ruleId as RuleId].label;
    const text = `Alert #${alert.id} fired: ${label} (severity: ${alert.severity}).`;
    if (llm || hasModelKey()) {
      await runAgent({ db, careProfileId: alert.careProfileId, input: { kind: "event", text }, llm });
      continue;
    }
    const profile = db.select().from(s.careProfiles).where(eq(s.careProfiles.id, alert.careProfileId)).get()!;
    postMessage(db, { careProfileId: profile.id, role: "event", content: text });
    postMessage(db, {
      careProfileId: profile.id,
      role: "assistant",
      content: `${(alert.evidence as Evidence).description}\n\n(CareAgent is offline: add OPENAI_API_KEY to .env for agent summaries.)`,
      blocks: [alertBlock(db, alert, profile)],
    });
  }
}

export async function runDailyReview(db: Db, careProfileId: number, llm?: LLM) {
  return runAgent({
    db, careProfileId, llm,
    input: { kind: "event", text: "Scheduled daily review. Check open alerts, recent trends, and medication supply; update the Home status line; post a short update only if something is worth the family's attention." },
  });
}

// Records a person's Approve / Decline. When the approval is complete (or declined), wakes the agent to act on it.
export async function handleDecision(db: Db, approvalId: number, userId: number, decision: "approve" | "decline",
  opts: { llm?: LLM; onEvent?: (e: StreamEvent) => void } = {}) {
  const { approval, member, waitingOn } = decideApproval(db, approvalId, userId, decision);
  const what = `approval #${approval.id} (${approval.summary.title})`;
  if (waitingOn) {
    const profile = db.select().from(s.careProfiles).where(eq(s.careProfiles.id, approval.careProfileId)).get()!;
    const who = waitingOn === "parent" ? profile.parentName.split(" ")[0] : "a caregiver";
    const msg = postMessage(db, { careProfileId: approval.careProfileId, role: "event", content: `${member.name} approved ${what}. Waiting on ${who}.` });
    return { approval, ran: false, message: msg };
  }
  const verb = decision === "approve" ? "approved" : "declined";
  const text = `${member.name} ${verb} ${what}.`;
  if (!(opts.llm || hasModelKey())) {
    postMessage(db, { careProfileId: approval.careProfileId, role: "event", content: text });
    return { approval, ran: false };
  }
  await runAgent({ db, careProfileId: approval.careProfileId, input: { kind: "event", text, actorId: userId }, llm: opts.llm, onEvent: opts.onEvent });
  return { approval, ran: true };
}
