import { readJson, statePath, writeJson } from "./store";

// Fake shared family calendar (think a Google Calendar the care circle subscribes to).

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  attendees: string[];
  appointmentId?: number;
  createdAt: string;
}

const file = () => statePath("family_calendar.json");

export const familyCalendar = {
  list(): CalendarEvent[] {
    return readJson<CalendarEvent[]>(file(), []).sort((a, b) => a.startAt.localeCompare(b.startAt));
  },
  // One event per appointment; adding again updates it.
  upsertForAppointment(ev: Omit<CalendarEvent, "id" | "createdAt"> & { appointmentId: number }, now: Date): CalendarEvent {
    const all = readJson<CalendarEvent[]>(file(), []);
    const existing = all.find((e) => e.appointmentId === ev.appointmentId);
    const event: CalendarEvent = { ...existing, ...ev, id: existing?.id ?? `cal_${ev.appointmentId}`, createdAt: existing?.createdAt ?? now.toISOString() };
    writeJson(file(), [...all.filter((e) => e !== existing), event]);
    return event;
  },
  removeForAppointment(appointmentId: number) {
    writeJson(file(), readJson<CalendarEvent[]>(file(), []).filter((e) => e.appointmentId !== appointmentId));
  },
};
