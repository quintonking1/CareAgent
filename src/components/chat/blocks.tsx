"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CalendarPlus, Check, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { dismissAlert } from "@/app/actions";
import { EmergencyPrompt } from "@/components/emergency-prompt";
import { SeverityBadge } from "@/components/severity-badge";
import { Sparkline } from "@/components/Sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Block } from "@/lib/blocks";

type Send = (text: string) => void;
export type Decide = (approvalId: number, decision: "approve" | "decline") => void;

const dayParts = (iso: string, timeZone: string) => {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { timeZone, ...o });
  return { key: f({ year: "numeric", month: "2-digit", day: "2-digit" }), weekday: f({ weekday: "short" }), month: f({ month: "short" }), day: f({ day: "numeric" }), time: f({ hour: "numeric", minute: "2-digit" }) };
};

function DateTile({ iso, timeZone }: { iso: string; timeZone: string }) {
  const p = dayParts(iso, timeZone);
  return (
    <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border bg-muted/40 py-1.5 leading-tight">
      <span className="text-[10px] font-medium uppercase text-destructive">{p.month}</span>
      <span className="text-lg font-semibold">{p.day}</span>
      <span className="text-[10px] text-muted-foreground">{p.weekday}</span>
    </div>
  );
}

// Open Zocdoc times grouped by day, like a small calendar. Tapping a time tells the agent which slot.
function SlotsBlock({ block, onSend, interactive }: { block: Extract<Block, { type: "slots" }>; onSend: Send; interactive: boolean }) {
  const days = new Map<string, typeof block.options>();
  for (const o of block.options) {
    const k = dayParts(o.startAt, block.timeZone).key + o.providerName;
    days.set(k, [...(days.get(k) ?? []), o]);
  }
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-sm font-medium"><CalendarPlus className="size-4" /> Open times</div>
      {block.note && <p className="mt-0.5 text-xs text-muted-foreground">{block.note}</p>}
      <div className="mt-3 flex flex-col gap-3">
        {[...days.values()].map((opts) => (
          <div key={opts[0].slotId} className="flex gap-3">
            <DateTile iso={opts[0].startAt} timeZone={block.timeZone} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{opts[0].providerName} <span className="font-normal text-muted-foreground">· {opts[0].specialty}</span></p>
              <p className="truncate text-xs text-muted-foreground">{opts[0].address}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {opts.map((o) => {
                  const p = dayParts(o.startAt, block.timeZone);
                  return (
                    <Button key={o.slotId} size="sm" variant="outline" className="h-8 rounded-full" disabled={!interactive}
                      onClick={() => onSend(`Book ${o.providerName} on ${p.weekday} ${p.month} ${p.day} at ${p.time} (slot ${o.slotId})`)}>
                      {p.time}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const APPROVAL_DONE: Record<string, string> = { approved: "Approved", executed: "Done", declined: "Declined", failed: "Couldn't complete" };

function ApprovalBlock({ block, onDecide, enabled }: { block: Extract<Block, { type: "approval" }>; onDecide: Decide; enabled: boolean }) {
  const pending = block.status === "pending";
  const approvedBy = block.decisions.filter((d) => d.decision === "approve").map((d) => d.name.split(" ")[0]);
  const declinedBy = block.decisions.find((d) => d.decision === "decline")?.name.split(" ")[0];
  const first = block.parentName.split(" ")[0];
  return (
    <div className={`rounded-2xl border-2 p-4 ${pending ? "border-foreground/80" : "opacity-80"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs your approval</span>
        {!pending && (
          <Badge variant={block.status === "declined" || block.status === "failed" ? "destructive" : "secondary"} className="rounded-full">
            {APPROVAL_DONE[block.status] ?? block.status}
          </Badge>
        )}
      </div>
      <p className="mt-1 font-medium">{block.title}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">{block.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      {block.reason && <p className="mt-2 text-sm">{block.reason}</p>}
      {block.parentRequired && <p className="mt-2 text-xs text-muted-foreground">{first} has asked to approve bookings too.</p>}
      {pending ? (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1 rounded-full" disabled={!enabled} onClick={() => onDecide(block.approvalId, "approve")}><Check /> Approve</Button>
          <Button variant="outline" className="flex-1 rounded-full" disabled={!enabled} onClick={() => onDecide(block.approvalId, "decline")}><X /> Decline</Button>
        </div>
      ) : null}
      {(approvedBy.length > 0 || declinedBy) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {declinedBy ? `Declined by ${declinedBy}` : `Approved by ${approvedBy.join(" and ")}`}{pending && approvedBy.length ? ` · waiting on ${block.parentRequired ? first : "a caregiver"}` : ""}
        </p>
      )}
    </div>
  );
}

function AppointmentBlock({ block, onSend, interactive }: { block: Extract<Block, { type: "appointment" }>; onSend: Send; interactive: boolean }) {
  const p = dayParts(block.startAt, block.timeZone);
  const cancelled = block.status === "cancelled";
  return (
    <div className={`rounded-2xl border p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <DateTile iso={block.startAt} timeZone={block.timeZone} />
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${cancelled ? "line-through" : ""}`}>{block.providerName}</p>
          <p className="text-sm text-muted-foreground">{block.specialty}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm"><Clock className="size-3.5 text-muted-foreground" /> {p.weekday}, {p.month} {p.day} · {p.time}</p>
          <p className="flex items-center gap-1.5 text-sm"><MapPin className="size-3.5 text-muted-foreground" /> <span className="truncate">{block.location}</span></p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cancelled ? (
          <Badge variant="destructive" className="rounded-full">Cancelled</Badge>
        ) : (
          <>
            <Badge variant="secondary" className="rounded-full">Zocdoc {block.confirmation}</Badge>
            {block.onCalendar && <Badge variant="secondary" className="rounded-full"><CalendarCheck /> On family calendar</Badge>}
            {interactive && (
              <Button size="sm" variant="ghost" className="ml-auto rounded-full text-muted-foreground"
                onClick={() => onSend(`Cancel the appointment with ${block.providerName} on ${p.month} ${p.day} (appointment #${block.appointmentId})`)}>
                Cancel
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AlertBlock({ block, onSend, interactive }: { block: Extract<Block, { type: "alert" }>; onSend: Send; interactive: boolean }) {
  const [status, setStatus] = useState(block.status);
  const [pending, start] = useTransition();
  const resolved = status === "resolved";
  const booked = status === "follow_up_booked";
  const urgent = block.severity === "urgent";
  const first = block.parentName.split(" ")[0];

  const dismiss = () => start(async () => {
    await dismissAlert(block.alertId);
    setStatus("resolved");
    toast(urgent ? `Marked as checked on ${first}` : "Alert dismissed");
  });

  return (
    <div className={`rounded-2xl border p-4 ${resolved ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={block.severity} />
        <span className="text-sm font-medium">{block.label}</span>
      </div>
      <div className="mt-3">
        {block.points.length > 1 ? (
          <Sparkline points={block.points} highlight={block.highlight} threshold={block.threshold} label={`${block.metricLabel}, 30 days`} />
        ) : (
          <p className="text-xs text-muted-foreground">{block.metricLabel} · {block.eventAt && new Date(block.eventAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
        )}
      </div>
      <Collapsible className="mt-2">
        <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
          Data behind this alert
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1 text-xs text-muted-foreground">
          {block.description} <span className="opacity-70">Alert #{block.alertId}.</span>
        </CollapsibleContent>
      </Collapsible>

      {urgent && !resolved && <div className="mt-3"><EmergencyPrompt parentName={block.parentName} parentPhone={block.parentPhone} /></div>}

      {booked ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarCheck className="size-3.5" /> Follow-up booked</p>
      ) : resolved ? (
        <p className="mt-3 text-xs text-muted-foreground">Dismissed</p>
      ) : (
        <div className="mt-3 flex gap-2">
          {!urgent && (
            <Button size="sm" className="rounded-full" disabled={!interactive}
              onClick={() => onSend(`Book a follow-up for alert #${block.alertId}`)}>
              <CalendarPlus /> Book follow-up
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={dismiss}>
            {urgent ? `I've checked on ${first}` : "Dismiss"}
          </Button>
        </div>
      )}
    </div>
  );
}

function TrendBlock({ block }: { block: Extract<Block, { type: "trend" }> }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium">{block.label}</div>
      {block.caption && <p className="text-xs text-muted-foreground">{block.caption}</p>}
      <div className="mt-2">
        <Sparkline points={block.points} highlight={block.highlight} label={`${block.points.length} days · ${block.unit}`} />
      </div>
    </div>
  );
}

export function BlockView({ block, onSend, onDecide, interactive, idle }: {
  block: Block;
  onSend: Send;
  onDecide: Decide;
  // interactive: this is the latest reply; idle: nothing is running.
  interactive: boolean;
  idle: boolean;
}) {
  if (block.type === "alert") return <AlertBlock block={block} onSend={onSend} interactive={interactive} />;
  if (block.type === "trend") return <TrendBlock block={block} />;
  if (block.type === "slots") return <SlotsBlock block={block} onSend={onSend} interactive={interactive} />;
  // Approvals stay actionable wherever they are in the thread until decided.
  if (block.type === "approval") return <ApprovalBlock block={block} onDecide={onDecide} enabled={idle} />;
  if (block.type === "appointment") return <AppointmentBlock block={block} onSend={onSend} interactive={idle} />;
  if (!interactive) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {block.options.map((o) => (
        <Button key={o} variant="outline" size="sm" className="h-auto rounded-full px-3.5 py-1.5 font-normal text-muted-foreground hover:text-foreground"
          onClick={() => onSend(o)}>
          {o}
        </Button>
      ))}
    </div>
  );
}
