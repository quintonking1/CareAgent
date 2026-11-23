import { readJson, statePath, writeJson } from "./store";

// Fake Zocdoc Partner API, used by the phone-first home ("/").
//
// The real API needs partner approval. It offers a provider directory, availability (a 30-day window,
// up to 150 days out) and booking with patient and insurance details, and returns an appointment_id.
// These functions return those shapes with fixed demo data so the demo is the same every time.
// (src/fakes/zocdoc.ts is the older slot generator the chat agent's tools use.)

export interface ZdProvider {
  provider_id: string;
  name: string;
  specialty: string;
  location: { address: string };
  accepted_insurance: string[];
}

export interface ZdTimeslot {
  start_time: string; // local ISO, America/Los_Angeles
  end_time: string;
  visit_type: "in_person" | "video";
}

export interface ZdAvailability {
  provider_id: string;
  window: { start_date: string; end_date: string }; // max 30 days, up to 150 days out
  insurance: { plan: string; in_network: boolean };
  timeslots: ZdTimeslot[];
}

export interface ZdBookingRequest {
  provider_id: string;
  start_time: string;
  visit_type: ZdTimeslot["visit_type"];
  patient: { first_name: string; last_name: string; date_of_birth: string };
  insurance: { plan: string; member_id?: string };
}

export interface ZdBooking {
  appointment_id: string;
  status: "confirmed";
  provider_id: string;
  start_time: string;
  booked_at: string;
}

export const ZD_PROVIDERS: ZdProvider[] = [
  {
    provider_id: "zd_cardio_001", name: "Dr. Marcus Lee", specialty: "Cardiology",
    location: { address: "5151 F St, Sacramento, CA" }, accepted_insurance: ["Blue Shield PPO", "Medicare"],
  },
  {
    provider_id: "zd_pcp_001", name: "Dr. Anita Patel", specialty: "Primary Care",
    location: { address: "2801 K St, Suite 200, Sacramento, CA" }, accepted_insurance: ["Blue Shield PPO", "Aetna PPO", "Medicare"],
  },
];

const SLOTS: Record<string, ZdTimeslot[]> = {
  zd_cardio_001: [
    { start_time: "2026-12-03T10:00:00-08:00", end_time: "2026-12-03T10:40:00-08:00", visit_type: "in_person" },
    { start_time: "2026-12-04T08:30:00-08:00", end_time: "2026-12-04T09:10:00-08:00", visit_type: "in_person" },
    { start_time: "2026-12-08T14:15:00-08:00", end_time: "2026-12-08T14:55:00-08:00", visit_type: "in_person" },
    { start_time: "2026-12-10T09:00:00-08:00", end_time: "2026-12-10T09:40:00-08:00", visit_type: "in_person" },
    { start_time: "2026-12-14T15:30:00-08:00", end_time: "2026-12-14T16:10:00-08:00", visit_type: "in_person" },
  ],
};

export class ZocdocPartnerError extends Error {}

const bookingsFile = () => statePath("zocdoc_partner_bookings.json");

export function getProvider(providerId: string) {
  const p = ZD_PROVIDERS.find((x) => x.provider_id === providerId);
  if (!p) throw new ZocdocPartnerError(`unknown provider ${providerId}`);
  return p;
}

export function getAvailability(providerId: string, plan: string, startDate = "2026-11-24"): ZdAvailability {
  const p = getProvider(providerId);
  const end = new Date(new Date(startDate).getTime() + 29 * 86_400_000).toISOString().slice(0, 10);
  const taken = new Set(readJson<ZdBooking[]>(bookingsFile(), []).map((b) => `${b.provider_id}|${b.start_time}`));
  return {
    provider_id: p.provider_id,
    window: { start_date: startDate, end_date: end },
    insurance: { plan, in_network: p.accepted_insurance.includes(plan) },
    timeslots: (SLOTS[providerId] ?? []).filter((s) => !taken.has(`${providerId}|${s.start_time}`)),
  };
}

export function book(req: ZdBookingRequest, at = new Date()): ZdBooking {
  const p = getProvider(req.provider_id);
  if (!p.accepted_insurance.includes(req.insurance.plan)) throw new ZocdocPartnerError(`${p.name} is not in network for ${req.insurance.plan}`);
  if (!(SLOTS[p.provider_id] ?? []).some((s) => s.start_time === req.start_time)) throw new ZocdocPartnerError("that time is not available");
  const all = readJson<ZdBooking[]>(bookingsFile(), []);
  const booking: ZdBooking = {
    appointment_id: `zd_appt_${(all.length + 1).toString().padStart(4, "0")}`,
    status: "confirmed", provider_id: p.provider_id, start_time: req.start_time, booked_at: at.toISOString(),
  };
  writeJson(bookingsFile(), [...all, booking]);
  return booking;
}
