import { readJson, statePath, writeJson } from "./store";

// Fake push/SMS service for notifying the care circle. Messages land in an outbox file.

export interface OutboxMessage {
  id: string;
  toUserId: number;
  toName: string;
  channel: "push";
  text: string;
  sentAt: string;
}

const file = () => statePath("outbox.json");

export const messaging = {
  send(msg: Omit<OutboxMessage, "id" | "sentAt">, now: Date): OutboxMessage {
    const all = readJson<OutboxMessage[]>(file(), []);
    const sent = { ...msg, id: `msg_${all.length + 1}`, sentAt: now.toISOString() };
    writeJson(file(), [...all, sent]);
    return sent;
  },
  all(): OutboxMessage[] {
    return readJson<OutboxMessage[]>(file(), []).reverse();
  },
  inbox(userId: number): OutboxMessage[] {
    return readJson<OutboxMessage[]>(file(), []).filter((m) => m.toUserId === userId).reverse();
  },
};
