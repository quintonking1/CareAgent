"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { DayButton } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import type { CalendarItem, CalendarKind } from "@/lib/overview";
import { cn } from "@/lib/utils";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const KIND: Record<CalendarKind, { label: string; dot: string }> = {
  appointment: { label: "Visit", dot: "bg-chart-1" },
  refill: { label: "Refill due", dot: "bg-chart-2" },
  alert: { label: "Alert", dot: "bg-destructive" },
  action: { label: "Done", dot: "bg-chart-3" },
};
const ORDER: CalendarKind[] = ["alert", "appointment", "refill", "action"];

// Day keys are YYYY-MM-DD in the parent's time zone, worked out on the server. Building local
// Dates from the parts keeps server and client renders identical whatever the viewer's zone.
const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DayItems = createContext<Map<string, CalendarItem[]>>(new Map());

function DayWithDots(props: React.ComponentProps<typeof DayButton>) {
  const byDay = useContext(DayItems);
  const kinds = [...new Set((byDay.get(toKey(props.day.date)) ?? []).map((i) => i.kind))];
  return (
    <CalendarDayButton {...props}>
      {props.children}
      <div className="flex h-1.5 gap-0.5" aria-hidden>
        {kinds.map((k) => <span key={k} className={cn("size-1.5 rounded-full", KIND[k].dot)} />)}
      </div>
    </CalendarDayButton>
  );
}

export function OverviewCalendar({ items, today }: { items: CalendarItem[]; today: string }) {
  const todayDate = useMemo(() => toDate(today), [today]);
  const [selected, setSelected] = useState<Date>(todayDate);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.day, [...(map.get(item.day) ?? []), item]);
    for (const list of map.values()) list.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    return map;
  }, [items]);

  const selectedKey = toKey(selected);
  const dayItems = byDay.get(selectedKey) ?? [];
  const nextUp = items.filter((i) => i.day > selectedKey && i.kind !== "action").sort((a, b) => a.day.localeCompare(b.day))[0];
  const heading = selectedKey === today ? "Today" : selected.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" /> Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <DayItems.Provider value={byDay}>
        <Calendar
          mode="single"
          required
          selected={selected}
          onSelect={setSelected}
          today={todayDate}
          defaultMonth={todayDate}
          className="p-0 [--cell-size:--spacing(9)]"
          classNames={{ root: "w-full" }}
          components={{ DayButton: DayWithDots }}
        />
        </DayItems.Provider>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {ORDER.map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", KIND[k].dot)} /> {KIND[k].label}</span>
          ))}
        </div>
        <Separator />
        <div>
          <p className="text-sm font-medium">{heading}</p>
          {dayItems.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing on this day.
              {nextUp && <> Next: {nextUp.title} on {toDate(nextUp.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</>}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {dayItems.map((i) => (
                <li key={i.id} className="flex gap-2.5 text-sm">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND[i.kind].dot)} />
                  <div className="min-w-0">
                    <p className="font-medium">{i.title}{i.time && <span className="font-normal text-muted-foreground"> · {i.time}</span>}</p>
                    {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
