// Shapes shared by the server (agent tools) and the client (chat UI). No DB imports here.
import type { Severity } from "@/rules/alerts";

export interface ChartPoint {
  id: number;
  value: number;
  date: string;
}

// One metric's recent trend against the parent's own baseline (Overview page and chat).
export interface VitalSummary {
  metric: string;
  label: string;
  unit: string;
  points: ChartPoint[];
  latest: number;
  baseline: number;
  deltaPct: number;
  flagged: boolean;
  // From the open alert on this metric, if any: its readings, threshold and plain-language evidence.
  alert?: { id: number; label: string; description: string; highlight: number[]; threshold?: number };
}

export type Block =
  | {
      type: "alert";
      alertId: number;
      severity: Severity;
      label: string;
      description: string;
      status: string;
      metricLabel: string;
      unit: string;
      points: ChartPoint[];
      highlight: number[];
      threshold?: number;
      eventAt?: string;
      parentName: string;
      parentPhone: string;
    }
  | {
      type: "trend";
      metric: string;
      label: string;
      unit: string;
      points: ChartPoint[];
      highlight: number[];
      caption?: string;
    }
  | { type: "health_overview"; parentName: string; caption?: string; vitals: VitalSummary[] }
  | { type: "quick_replies"; options: string[] }
  | {
      type: "slots";
      timeZone: string;
      note?: string;
      options: { slotId: string; providerName: string; specialty: string; startAt: string; address: string }[];
    }
  | {
      type: "approval";
      approvalId: number;
      title: string;
      lines: string[];
      reason?: string;
      status: string;
      parentRequired: boolean;
      parentName: string;
      decisions: { name: string; role: string; decision: "approve" | "decline" }[];
    }
  | {
      type: "appointment";
      appointmentId: number;
      providerName: string;
      specialty: string;
      startAt: string;
      location: string;
      confirmation: string;
      status: string;
      timeZone: string;
      onCalendar: boolean;
    };

export interface TraceStep {
  tool: string;
  label: string;
  ok: boolean;
}

export interface AgentTrace {
  steps: TraceStep[];
  ms: number;
  error?: string;
}

export interface StatusLine {
  text: string;
  sourceAlertIds: number[];
  sourceMetrics: string[];
  at: string;
}

// Wire format streamed from /api/chat (one JSON object per line).
export type StreamEvent =
  | { type: "input"; message: SerializedMessage }
  | { type: "step"; step: TraceStep }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "block"; block: Block }
  | { type: "done"; message: SerializedMessage }
  | { type: "error"; text: string }
  // A decision was recorded but the agent didn't run (waiting on someone else, or offline).
  | { type: "settled" };

export interface SerializedMessage {
  id: number;
  role: "assistant" | "user" | "event";
  authorName?: string;
  content: string;
  blocks: Block[];
  trace: AgentTrace | null;
  createdAt: string;
}
