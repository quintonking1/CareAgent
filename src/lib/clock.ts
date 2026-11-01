export const DAY_MS = 86_400_000;

// Single source of "now" so the demo clock (milestone 7) can shift it later.
export function now(): Date {
  return new Date();
}

export const dateKey = (iso: string) => iso.slice(0, 10);

export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Event times are shown in the parent's local time zone.
export function fmtDateTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short",
  });
}

function tzOffsetMs(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at.getTime();
}

// "2026-11-04" + "10:30" in America/Los_Angeles -> the UTC instant.
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
}

// The calendar date (YYYY-MM-DD) and weekday of an instant in a time zone.
export function localDay(at: Date, timeZone: string) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(at).toLowerCase();
  return { date, weekday };
}

export function fmtSlot(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone,
  });
}
