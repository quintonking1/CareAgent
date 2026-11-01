import path from "node:path";
import { DAY_MS, localDay, zonedToUtc } from "@/lib/clock";
import { readJson, seedDir, statePath, writeJson } from "./store";

// Fake Zocdoc. The directory is data/fakes/zocdoc.json; open slots are generated from each doctor's weekly
// hours (minus a deterministic share pre-booked by "other patients" and our own bookings). No network calls.

export interface ZocdocProvider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  accepts: string[];
  visit_minutes: number;
  hours: Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string]>>;
  busy: number;
  first_available_in_days?: number;
}

interface Directory {
  timezone: string;
  providers: ZocdocProvider[];
}

export interface Slot {
  slotId: string;
  providerId: string;
  startAt: string;
  endAt: string;
}

export interface Booking {
  confirmation: string;
  slotId: string;
  providerId: string;
  patientName: string;
  insurancePlan: string;
  startAt: string;
  status: "booked" | "cancelled";
  bookedAt: string;
  cancelledAt?: string;
}

export class ZocdocError extends Error {}

const HORIZON_DAYS = 60;
const LEAD_MS = 2 * 60 * 60 * 1000; // can't book within 2 hours

const bookingsFile = () => statePath("zocdoc_bookings.json");

// Small stable hash so "pre-booked by other patients" is the same on every search.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface ZocdocAdapter {
  listProviders(filter?: { specialty?: string }): ZocdocProvider[];
  getProvider(id: string): ZocdocProvider;
  acceptsInsurance(providerId: string, plan: string): boolean;
  searchSlots(providerId: string, from: Date, days: number): Slot[];
  book(slotId: string, patient: { name: string; insurancePlan: string }, now: Date): Booking;
  cancel(confirmation: string, now: Date): Booking;
  getBooking(confirmation: string): Booking | undefined;
}

export class FakeZocdocAdapter implements ZocdocAdapter {
  private directory(): Directory {
    return readJson<Directory>(path.join(seedDir(), "zocdoc.json"), { timezone: "UTC", providers: [] });
  }

  private bookings(): Booking[] {
    return readJson<Booking[]>(bookingsFile(), []);
  }

  listProviders(filter: { specialty?: string } = {}) {
    const want = filter.specialty?.toLowerCase();
    return this.directory().providers.filter((p) => !want || p.specialty.toLowerCase() === want);
  }

  getProvider(id: string) {
    const p = this.directory().providers.find((x) => x.id === id);
    if (!p) throw new ZocdocError(`provider ${id} not found`);
    return p;
  }

  acceptsInsurance(providerId: string, plan: string) {
    return this.getProvider(providerId).accepts.includes(plan);
  }

  // Every slot in the provider's hours, ignoring bookings, from `from` for `days` days.
  private scheduled(p: ZocdocProvider, tz: string, from: Date, days: number): Slot[] {
    const out: Slot[] = [];
    const today = localDay(from, tz).date;
    for (let d = 0; d < days; d++) {
      const { date, weekday } = localDay(new Date(from.getTime() + d * DAY_MS), tz);
      const hours = p.hours[weekday as keyof ZocdocProvider["hours"]];
      const dayIndex = Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
      if (!hours || dayIndex < (p.first_available_in_days ?? 0)) continue;
      for (let m = toMinutes(hours[0]); m + p.visit_minutes <= toMinutes(hours[1]); m += p.visit_minutes) {
        const start = zonedToUtc(date, toHHMM(m), tz);
        out.push({
          slotId: `${p.id}@${date}T${toHHMM(m)}`,
          providerId: p.id,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + p.visit_minutes * 60_000).toISOString(),
        });
      }
    }
    return out;
  }

  private isOpen(slot: Slot, p: ZocdocProvider, now: Date, taken: Set<string>) {
    return Date.parse(slot.startAt) - now.getTime() >= LEAD_MS
      && hash(slot.slotId) >= p.busy * 1000
      && !taken.has(slot.slotId);
  }

  searchSlots(providerId: string, from: Date, days: number) {
    const p = this.getProvider(providerId);
    const taken = new Set(this.bookings().filter((b) => b.status === "booked").map((b) => b.slotId));
    return this.scheduled(p, this.directory().timezone, from, Math.min(days, HORIZON_DAYS))
      .filter((s) => this.isOpen(s, p, from, taken));
  }

  book(slotId: string, patient: { name: string; insurancePlan: string }, now: Date): Booking {
    const providerId = slotId.split("@")[0];
    const p = this.getProvider(providerId);
    const slot = this.searchSlots(providerId, now, HORIZON_DAYS).find((s) => s.slotId === slotId);
    if (!slot) throw new ZocdocError(`slot ${slotId} is no longer available`);
    if (!p.accepts.includes(patient.insurancePlan)) {
      throw new ZocdocError(`${p.name} does not accept ${patient.insurancePlan}`);
    }
    const booking: Booking = {
      confirmation: `ZD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      slotId, providerId, patientName: patient.name, insurancePlan: patient.insurancePlan,
      startAt: slot.startAt, status: "booked", bookedAt: now.toISOString(),
    };
    writeJson(bookingsFile(), [...this.bookings(), booking]);
    return booking;
  }

  cancel(confirmation: string, now: Date): Booking {
    const all = this.bookings();
    const b = all.find((x) => x.confirmation === confirmation);
    if (!b) throw new ZocdocError(`booking ${confirmation} not found`);
    if (b.status === "cancelled") throw new ZocdocError(`booking ${confirmation} is already cancelled`);
    b.status = "cancelled";
    b.cancelledAt = now.toISOString();
    writeJson(bookingsFile(), all);
    return b;
  }

  getBooking(confirmation: string) {
    return this.bookings().find((b) => b.confirmation === confirmation);
  }
}

export const zocdoc: ZocdocAdapter = new FakeZocdocAdapter();
