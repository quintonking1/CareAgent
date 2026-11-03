"use client";

import Link from "next/link";
import {
  BellRing, Bot, CalendarCheck, CircleCheck, CircleX, ClipboardCheck, FileText, MessageSquare, Pill, Send, Watch,
} from "lucide-react";
import type { UpdateIcon, UpdateItem, UpdateKind } from "@/lib/overview";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ICON: Record<UpdateIcon, React.ElementType> = {
  alert: BellRing, approval: ClipboardCheck, done: CircleCheck, failed: CircleX, appointment: CalendarCheck,
  message: Send, visit: FileText, pill: Pill, chat: MessageSquare,
};
const ICON_TONE: Partial<Record<UpdateIcon, string>> = {
  alert: "text-destructive", done: "text-emerald-600 dark:text-emerald-400", failed: "text-destructive",
};
const TABS: { value: "all" | UpdateKind; label: string }[] = [
  { value: "all", label: "All" }, { value: "health", label: "Health" }, { value: "action", label: "Actions" }, { value: "family", label: "Family" },
];

function ActorAvatar({ actor }: { actor: string }) {
  const isAgent = actor === "CareAgent";
  const isWatch = actor.endsWith("watch");
  return (
    <Avatar className="size-8">
      <AvatarFallback className={cn("text-xs", isAgent && "bg-primary text-primary-foreground")}>
        {isAgent ? <Bot className="size-4" /> : isWatch ? <Watch className="size-4" /> : actor.split(" ").map((p) => p[0]).join("").slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  );
}

function UpdateCard({ u }: { u: UpdateItem }) {
  const Icon = ICON[u.icon];
  return (
    <li className="flex gap-3 rounded-xl border bg-background/60 p-3">
      <ActorAvatar actor={u.actor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className={cn("size-3.5 shrink-0", ICON_TONE[u.icon] ?? "text-muted-foreground")} />
            {u.title}
          </p>
          {u.severity && <SeverityBadge severity={u.severity} className="shrink-0" />}
        </div>
        {u.detail && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{u.detail}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{u.actor} · {u.when}</p>
      </div>
    </li>
  );
}

export function UpdatesFeed({ items, parentName }: { items: UpdateItem[]; parentName: string }) {
  const first = parentName.split(" ")[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Latest updates</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="rounded-full"><Link href="/"><MessageSquare /> Open chat</Link></Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="mb-3">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                <span className="ml-1 text-xs text-muted-foreground">
                  {t.value === "all" ? items.length : items.filter((i) => i.kind === t.value).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => {
            const list = t.value === "all" ? items : items.filter((i) => i.kind === t.value);
            return (
              <TabsContent key={t.value} value={t.value}>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No updates in the last two weeks. When {first}&apos;s watch flags something or CareAgent takes an action, it shows up here.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">{list.map((u) => <UpdateCard key={u.id} u={u} />)}</ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
