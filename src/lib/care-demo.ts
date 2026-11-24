// Demo state for the phone-first home ("/"). One CareState object drives everything the home shows:
// the headline and status line, Needs you cards, medication rows, upcoming visits, the activity log
// and watch-sync freshness. All data is synthetic, matching the "CareAgent Home" design (Page 2).
// No DB or server imports here: this runs in the browser.

export interface Slot {
  id: string;
  startTime: string; // matches the fake Zocdoc timeslot start_time
  day: string; // "Thu, Dec 3"
  time: string; // "10:00 AM"
  short: string; // "Thu 10 AM"
  dayNum: string;
  weekday: string; // "Thursday"
  note: string;
  morning: boolean;
}

export const SLOTS: Slot[] = [
  { id: "s1", startTime: "2026-12-03T10:00:00-08:00", day: "Thu, Dec 3", time: "10:00 AM", short: "Thu 10 AM", dayNum: "3", weekday: "Thursday", note: "Dr. Marcus Lee, cardiology", morning: true },
  { id: "s2", startTime: "2026-12-04T08:30:00-08:00", day: "Fri, Dec 4", time: "8:30 AM", short: "Fri 8:30 AM", dayNum: "4", weekday: "Friday", note: "Before your 10:00 meeting", morning: true },
  { id: "s3", startTime: "2026-12-08T14:15:00-08:00", day: "Tue, Dec 8", time: "2:15 PM", short: "Tue 2:15 PM", dayNum: "8", weekday: "Tuesday", note: "Dr. Marcus Lee, cardiology", morning: false },
];
export const LATER_SLOTS: Slot[] = [
  { id: "s4", startTime: "2026-12-10T09:00:00-08:00", day: "Thu, Dec 10", time: "9:00 AM", short: "Thu Dec 10, 9 AM", dayNum: "10", weekday: "Thursday", note: "Dr. Marcus Lee, cardiology", morning: true },
  { id: "s5", startTime: "2026-12-14T15:30:00-08:00", day: "Mon, Dec 14", time: "3:30 PM", short: "Mon Dec 14, 3:30 PM", dayNum: "14", weekday: "Monday", note: "Dr. Marcus Lee, cardiology", morning: false },
];
export const ALL_SLOTS = [...SLOTS, ...LATER_SLOTS];

export const DAD = {
  name: "Dad", phone: "5550100142", address: "418 Alder Lane, Sacramento",
  allergy: "Allergic to penicillin", meds: "Takes Lisinopril, Metformin, Atorvastatin",
};
export const DR_LEE = { name: "Dr. Marcus Lee", short: "Dr. Lee", specialty: "Cardiology", providerId: "zd_cardio_001", phone: "5550100100", plan: "Blue Shield PPO" };
export const DR_PATEL = { name: "Dr. Anita Patel", short: "Dr. Patel", specialty: "Primary care", phone: "5550100300" };
export const PHARMACY = { name: "Walgreens Folsom Blvd", phone: "5550100200", rxNumber: "4471" };

// 30 days of resting heart rate: flat near 64, then 70 to 73 for the last 5 days.
export const HR_30 = [64, 63, 65, 64, 62, 64, 65, 63, 64, 66, 64, 63, 65, 64, 63, 64, 65, 64, 63, 65, 64, 66, 64, 65, 64, 70, 71, 72, 73, 72];
export const HR_14 = HR_30.slice(-14);
export const HR_USUAL = 64;
export const HR_ALERT = 70;

export type Tone = "coral" | "indigo" | "teal" | "tan";
export interface Vital {
  id: "hr" | "sleep" | "spo2" | "steps";
  label: string;
  value: string;
  unit: string;
  usual: string;
  chip: string;
  tone: Tone;
  flagged: boolean;
  points: number[];
  context: string; // what the agent is told the person is looking at
}

export const VITALS: Vital[] = [
  { id: "hr", label: "Resting HR", value: "72", unit: "bpm", usual: "Usual 64", chip: "+12%", tone: "coral", flagged: true,
    points: [63, 64, 65, 63, 64, 66, 70, 71, 72, 73, 72],
    context: "Dad's resting heart rate tile: 72 bpm this week, usual 64, above 70 for 5 days in a row since Nov 12. No irregular rhythm alerts." },
  { id: "sleep", label: "Sleep", value: "7.1", unit: "h", usual: "Usual 7.0", chip: "Normal", tone: "indigo", flagged: false,
    points: [6.8, 7.2, 7.0, 6.9, 7.3, 7.1, 6.9, 7.2, 7.0, 7.1, 7.1],
    context: "Dad's sleep tile: 7.1 hours a night this week, usual 7.0." },
  { id: "spo2", label: "Blood oxygen", value: "96", unit: "%", usual: "Usual 97", chip: "Normal", tone: "teal", flagged: false,
    points: [97, 96, 97, 98, 97, 96, 97, 96, 97, 96, 96],
    context: "Dad's blood oxygen tile: 96% this week, usual 97%." },
  { id: "steps", label: "Steps", value: "4,820", unit: "", usual: "Usual 5,100 a day", chip: "Normal", tone: "tan", flagged: false,
    points: [5200, 4900, 5300, 5050, 4700, 5150, 4950, 4600, 5000, 4750, 4820],
    context: "Dad's steps tile: 4,820 a day this week, usual 5,100." },
];

export interface ActivityItem { title: string; when: string }

export type RefillStatus = "due" | "sent" | "ready" | "picked_up";
export type Fulfillment = "pickup" | "delivery";

export interface CareState {
  booked: Slot | null;
  bookingSnoozed: boolean;
  // Sheet closed while the agent worked: the task waits in Needs you.
  bookingParked: "working" | "times" | null;
  refill: RefillStatus;
  refillFulfillment: Fulfillment;
  refillSupply: 30 | 90;
  refillSnoozed: boolean;
  refillParked: "working" | "approve" | null;
  bookingAlsoDad: boolean;
  brief: "none" | "ready" | "marked";
  briefQuestions: string[];
  briefShared: boolean;
  newRx: string[];
  visitDone: boolean;
  notesSaved: boolean;
  syncStale: boolean;
  emergency: boolean;
  hrAlertSeen: boolean;
  activity: ActivityItem[]; // newest first, added on top of the base log
}

export const INITIAL_STATE: CareState = {
  booked: null, bookingSnoozed: false, bookingParked: null,
  refill: "due", refillFulfillment: "pickup", refillSupply: 30, refillSnoozed: false, refillParked: null,
  bookingAlsoDad: false,
  brief: "none", briefShared: false, newRx: [],
  briefQuestions: ["What could be raising his resting heart rate?", "Should any of his medications change?", "When should we check it again?"],
  visitDone: false, notesSaved: false,
  syncStale: false, emergency: false, hrAlertSeen: false,
  activity: [],
};

const BASE_ACTIVITY: ActivityItem[] = [
  { title: "Flagged resting heart rate trend", when: "Today, 7:40 AM" },
  { title: "Requested Atorvastatin refill", when: "Wed, Nov 4, you approved" },
  { title: "Booked Dr. Patel, primary care", when: "Mon, Nov 2, you approved" },
];

// ---------- what the home shows ----------

export type CardAction =
  | "open-booking" | "snooze-booking" | "open-refill" | "snooze-refill" | "review-brief" | "snooze-brief"
  | "picked-up" | "directions" | "open-notes";

export type NeedsYouCardData =
  | { kind: "approval"; id: string; title: string; body: string; primary: { label: string; action: CardAction }; secondary?: { label: string; action: CardAction } }
  | { kind: "progress"; id: string; title: string; body: string; steps: Step[]; action: CardAction }
  | { kind: "refill"; id: string }
  | { kind: "track"; id: string; title: string; steps: (Step & { sub: string })[]; action?: CardAction };

export interface Step { label: string; state: "done" | "work" | "todo" }

export interface MedRow { name: string; schedule: string; note: string; tone: "alert" | "ok" | "plain"; refill: boolean }
export interface Appt { mon: string; day: string; who: string; what: string; chip?: { label: string; action: CardAction } }

export interface HomeView {
  h1: string;
  sub: string;
  status: string | null;
  notification: { title: string; body: string } | null;
  cards: NeedsYouCardData[];
  needsCount: number;
  meds: MedRow[];
  appts: Appt[];
  activity: ActivityItem[];
}

export const BOOKING_STEPS = ["Searched Zocdoc for Dr. Lee's openings", "Checked Blue Shield PPO coverage", "Matching your calendar"];
export const BOOKING_STEPS_DONE = ["Searched Zocdoc for Dr. Lee's openings", "Checked Blue Shield PPO coverage", "Matched your calendar"];
export const REFILL_STEPS = ["Found it at Walgreens Folsom Blvd", "2 refills left on Dr. Patel's prescription", "Checking price and pickup time"];
export const REFILL_STEPS_DONE = ["Found it at Walgreens Folsom Blvd", "2 refills left on Dr. Patel's prescription", "Checked price and pickup time"];

const working = (labels: string[]): Step[] => labels.map((label, i) => ({ label, state: i === labels.length - 1 ? "work" : "done" }));

export function homeView(s: CareState): HomeView {
  const cards: NeedsYouCardData[] = [];
  let h1 = "Good evening, Maya. Tonight Dad's mostly okay";
  let sub = "His resting heart rate has run high for 5 days. Sleep and steps look normal this week.";
  let status: string | null = null;
  let notification: HomeView["notification"] = null;

  // Flow 2 (brief, then the visit) comes after a booking.
  if (s.booked && s.brief !== "none" && !s.visitDone) {
    h1 = `Dr. Lee visit ${s.booked.weekday === "Thursday" ? "tomorrow" : "soon"}, Maya`;
    sub = "His heart rate is still a little high. Everything else is normal.";
  }
  if (s.visitDone) {
    h1 = "Good afternoon, Maya. Dad's mostly okay";
    sub = "He saw Dr. Lee this morning. Sleep and steps look normal this week.";
    if (!s.notesSaved) notification = { title: "How did Dr. Lee's visit go?", body: "Add notes and any new prescriptions." };
  }

  // Booking (Flow 1)
  if (s.booked) {
    status = `Dr. Lee, ${s.booked.short}, booked`;
    if (s.brief === "ready") cards.push({ kind: "approval", id: "brief", title: "Dr. Lee brief is ready",
      body: "Wearable trends, his meds, recent alerts and 3 questions to ask. About 2 minutes.",
      primary: { label: "Review brief", action: "review-brief" }, secondary: { label: "Later", action: "snooze-brief" } });
    if (s.visitDone) status = null;
  } else if (s.bookingParked === "working") {
    cards.push({ kind: "progress", id: "booking", title: "Finding times with Dr. Lee", body: "Cardiology follow-up, in person, next 2 weeks", steps: working(BOOKING_STEPS), action: "open-booking" });
  } else if (s.bookingParked === "times") {
    cards.push({ kind: "approval", id: "booking", title: "Pick a time with Dr. Lee", body: "3 open times in the next two weeks, all in network for Blue Shield PPO.",
      primary: { label: "See times", action: "open-booking" }, secondary: { label: "Not now", action: "snooze-booking" } });
  } else if (!s.bookingSnoozed) {
    cards.push({ kind: "approval", id: "booking", title: "Book a follow-up with Dr. Lee?",
      body: "Resting heart rate high for 5 days, and his cardiology follow-up is due. In network for Blue Shield PPO.",
      primary: { label: "Book", action: "open-booking" }, secondary: { label: "Not now", action: "snooze-booking" } });
  }

  // Refill (Flow 3)
  const how = s.refillFulfillment === "pickup" ? "pickup Wed" : "delivery Thu";
  if (s.refill === "due") {
    if (s.refillParked === "working") {
      cards.push({ kind: "progress", id: "refill", title: "Checking Walgreens", body: "Lisinopril 10 mg, Rx ending 4471", steps: working(REFILL_STEPS.map((l) => l.replace(" on Dr. Patel's prescription", ""))), action: "open-refill" });
    } else if (s.refillParked === "approve") {
      cards.push({ kind: "refill", id: "refill" });
    } else if (!s.refillSnoozed) {
      cards.push({ kind: "approval", id: "refill", title: "5 days of Lisinopril left", body: "30-day supply, last filled Oct 29 at Walgreens.",
        primary: { label: "Check refill", action: "open-refill" }, secondary: { label: "Not now", action: "snooze-refill" } });
    }
  } else if (s.refill === "sent") {
    status ??= "Lisinopril refill sent to Walgreens";
    cards.push({ kind: "track", id: "refill", title: "Lisinopril at Walgreens", steps: [
      { label: "Sent to Walgreens", sub: "Mon 6:20 PM", state: "done" },
      { label: "Being filled", sub: PHARMACY.name, state: "work" },
      { label: s.refillFulfillment === "pickup" ? "Ready for pickup" : "Out for delivery", sub: s.refillFulfillment === "pickup" ? "Expected Wed" : "Expected Thu", state: "todo" },
    ] });
  } else if (s.refill === "ready") {
    status = s.refillFulfillment === "pickup" ? "Lisinopril ready for pickup Wed" : "Lisinopril arrives Thu";
    cards.push(s.refillFulfillment === "pickup"
      ? { kind: "approval", id: "refill", title: "Ready at Walgreens", body: "Folsom Blvd is open until 9 PM. $4.00 copay. Anyone Dad sends can pick it up.",
          primary: { label: "Picked up", action: "picked-up" }, secondary: { label: "Directions", action: "directions" } }
      : { kind: "approval", id: "refill", title: "Lisinopril on its way", body: "Walgreens delivers to Dad's home Thursday. $4.00 copay, free delivery.",
          primary: { label: "Got it", action: "picked-up" } });
  }

  if (s.visitDone && !s.notesSaved) cards.unshift({ kind: "approval", id: "notes", title: "Add notes from Dr. Lee", body: "Any new prescriptions and when to follow up.",
    primary: { label: "Add notes", action: "open-notes" } });

  const lisinopril: MedRow = s.refill === "due"
    ? { name: "Lisinopril 10 mg", schedule: "Once daily", note: "5 days left", tone: "alert", refill: true }
    : s.refill === "sent"
      ? { name: "Lisinopril 10 mg", schedule: "Once daily", note: "Sent to Walgreens", tone: "ok", refill: false }
      : s.refill === "ready"
        ? { name: "Lisinopril 10 mg", schedule: "Once daily", note: s.refillFulfillment === "pickup" ? "Ready for pickup Wed" : "Arrives Thu", tone: "ok", refill: false }
        : { name: "Lisinopril 10 mg", schedule: "Once daily", note: "30 days left", tone: "plain", refill: false };
  const meds: MedRow[] = [
    lisinopril,
    { name: "Atorvastatin 20 mg", schedule: "Once daily", note: "18 days left", tone: "plain", refill: false },
    { name: "Metformin 500 mg", schedule: "Twice daily", note: "50 days left", tone: "plain", refill: false },
  ];
  if (s.notesSaved) for (const rx of s.newRx) meds.push({ name: rx, schedule: "New from Dr. Lee", note: "watching for it at Walgreens", tone: "ok", refill: false });

  const appts: Appt[] = [];
  if (s.booked && !s.visitDone) appts.push({ mon: "DEC", day: s.booked.dayNum, who: DR_LEE.name, what: `Cardiology, ${s.booked.day.split(", ")[0]} ${s.booked.time}`,
    chip: s.brief === "none" ? { label: "Brief Wed", action: "review-brief" } : { label: s.brief === "marked" ? "Brief ready" : "Review brief", action: "review-brief" } });
  appts.push({ mon: "DEC", day: "15", who: DR_PATEL.name, what: "Primary care, Tue 2:00 PM" });

  const activity = [...s.activity, ...BASE_ACTIVITY];

  return {
    h1, sub, status, notification, cards,
    needsCount: cards.filter((c) => c.kind === "approval" || c.kind === "refill").length,
    meds, appts, activity,
  };
}

export const activitySummary = (items: ActivityItem[]) =>
  items.slice(0, 2).map((a) => a.title).join(", then ") + (items.length > 2 ? `, and ${items.length - 2} more` : "");

// ---------- jumping to any step ----------

export type Overlay =
  | { kind: "none" }
  | { kind: "chart" }
  | { kind: "month" }
  | { kind: "booking"; phase: "working" | "times" }
  | { kind: "refill"; phase: "working" | "approve" }
  | { kind: "ask"; title: string; context: string; first?: string }
  | { kind: "page"; page: "booked" | "refill-sent" | "brief" | "brief-ready" | "brief-show" | "notes" };

export interface DemoStep { id: string; group: string; label: string; state: Partial<CareState>; overlay: Overlay }

const booked: Partial<CareState> = { booked: SLOTS[0], activity: [{ title: "Booked Dr. Lee for Thu, Dec 3 and added it to the family calendar", when: "Mon, Nov 23, you approved" }] };

export const DEMO_STEPS: DemoStep[] = [
  { id: "home", group: "Flow 1: Appointment", label: "Home", state: {}, overlay: { kind: "none" } },
  { id: "hr-chart", group: "Flow 1: Appointment", label: "Heart rate chart", state: {}, overlay: { kind: "chart" } },
  { id: "hr-month", group: "Flow 1: Appointment", label: "Month view", state: {}, overlay: { kind: "month" } },
  { id: "book-working", group: "Flow 1: Appointment", label: "Agent finds times", state: {}, overlay: { kind: "booking", phase: "working" } },
  { id: "book-times", group: "Flow 1: Appointment", label: "Pick a time", state: {}, overlay: { kind: "booking", phase: "times" } },
  { id: "booked", group: "Flow 1: Appointment", label: "Booked page", state: booked, overlay: { kind: "page", page: "booked" } },
  { id: "home-booked", group: "Flow 1: Appointment", label: "Home, booked", state: booked, overlay: { kind: "none" } },
  { id: "brief-ready", group: "Flow 2: Visit brief", label: "Brief ready", state: { ...booked, brief: "ready" }, overlay: { kind: "none" } },
  { id: "brief", group: "Flow 2: Visit brief", label: "Review brief", state: { ...booked, brief: "ready" }, overlay: { kind: "page", page: "brief" } },
  { id: "brief-marked", group: "Flow 2: Visit brief", label: "Brief marked ready", state: { ...booked, brief: "marked" }, overlay: { kind: "page", page: "brief-ready" } },
  { id: "brief-show", group: "Flow 2: Visit brief", label: "Show at the visit", state: { ...booked, brief: "marked" }, overlay: { kind: "page", page: "brief-show" } },
  { id: "visit-notify", group: "Flow 2: Visit brief", label: "After the visit", state: { ...booked, brief: "marked", visitDone: true }, overlay: { kind: "none" } },
  { id: "visit-notes", group: "Flow 2: Visit brief", label: "Visit notes", state: { ...booked, brief: "marked", visitDone: true }, overlay: { kind: "page", page: "notes" } },
  { id: "refill-working", group: "Flow 3: Refill", label: "Agent checks Walgreens", state: {}, overlay: { kind: "refill", phase: "working" } },
  { id: "refill-approve", group: "Flow 3: Refill", label: "Approve refill", state: {}, overlay: { kind: "refill", phase: "approve" } },
  { id: "refill-sent", group: "Flow 3: Refill", label: "Refill sent page", state: { refill: "sent" }, overlay: { kind: "page", page: "refill-sent" } },
  { id: "home-refill-sent", group: "Flow 3: Refill", label: "Home, being filled", state: { refill: "sent" }, overlay: { kind: "none" } },
  { id: "home-refill-ready", group: "Flow 3: Refill", label: "Home, ready for pickup", state: { refill: "ready" }, overlay: { kind: "none" } },
  { id: "sync-stale", group: "Other states", label: "Watch not syncing", state: { syncStale: true }, overlay: { kind: "none" } },
  { id: "all-clear", group: "Other states", label: "All caught up", state: { bookingSnoozed: true, refillSnoozed: true }, overlay: { kind: "none" } },
  { id: "emergency", group: "Other states", label: "Urgent: possible fall", state: { emergency: true }, overlay: { kind: "none" } },
];

export const stepById = (id: string | null | undefined) => DEMO_STEPS.find((s) => s.id === id);

// ---------- canned answers (used when the agent is offline) ----------

export const CANNED: Record<string, string> = {
  "Why is this flagged?": "Dad's resting heart rate has been above 70 for 5 days in a row. Over the past month it sat around 64. His watch hasn't logged any irregular rhythm, and his sleep and steps are steady, so this isn't urgent. It's still worth a check with Dr. Lee, since he takes Lisinopril for blood pressure.",
  "What should I ask Dr. Lee?": "Ask what could be raising his resting heart rate, whether any of his medications should change, and when to check it again. I'll put these in the visit brief.",
  "What changed on Nov 12?": "Nothing else in his data changed that day. Sleep, steps and blood oxygen stayed in his usual range. The watch didn't log a fall or an irregular rhythm.",
  "Compare to 3 months": "Over 3 months his resting heart rate averaged 64 and never ran above 70 for more than a day. These last 5 days are the first stretch like this.",
  "What will Dr. Lee check?": "A cardiology follow-up usually means a talk about the trend, a blood pressure check and maybe an ECG. I'll attach his heart rate chart so Dr. Lee sees it before the visit.",
  "Could it be a video visit?": "Dr. Lee's Zocdoc times are in person only for follow-ups. I can look for a video visit with another in-network cardiologist if that's easier.",
  "Add it to Dad's calendar too": "Sure. When you tap Book, I'll add it to both your calendar and Dad's.",
  "Why is the copay $4.00?": "That's his Blue Shield PPO copay for a 30-day supply of generic Lisinopril at Walgreens. A 90-day supply would be $10.00.",
  "Remind Dad to pick it up": "Okay. When it's ready, I'll text Dad a pickup reminder and tell you too.",
  "Use a different Walgreens": "His prescription is on file at Walgreens Folsom Blvd. A different store would need the pharmacy to move it, which Walgreens can't do through the app yet. Call the store and they can help.",
  "Is Dad okay this week?": "Mostly, yes. His resting heart rate has run high for 5 days, which is why I suggested a follow-up with Dr. Lee. Sleep, steps and blood oxygen are all in his usual range.",
};

export function cannedAnswer(q: string) {
  return CANNED[q] ?? "I'm offline right now, so I can't look that up. Your data is still on the home page, and the buttons there still work.";
}
