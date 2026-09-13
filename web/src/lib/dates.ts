// Day keys are plain calendar dates ("2026-09-13") in the user's profile
// timezone. All calendar arithmetic happens on keys in UTC, which has no DST,
// so adding a day is always exactly one calendar day.

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const keyFormatters = new Map<string, Intl.DateTimeFormat>();

export function dayKeyInZone(date: Date, tz: string): string {
  let f = keyFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    keyFormatters.set(tz, f);
  }
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayKey(tz: string): string {
  return dayKeyInZone(new Date(), tz);
}

export function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: string, n: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtcDate(a).getTime() - keyToUtcDate(b).getTime()) / 86_400_000);
}

export function weekStartKey(key: string): string {
  const dow = (keyToUtcDate(key).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(key, -dow);
}

export function listDays(startKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startKey, i));
}

// A UTC query window guaranteed to cover every local day in [startKey, endKey]
// for any timezone (offsets top out around ±14h). Rows are then bucketed
// client-side by their local day key.
export function queryWindow(startKey: string, endKey: string): { from: string; to: string } {
  return {
    from: keyToUtcDate(addDays(startKey, -1)).toISOString(),
    to: keyToUtcDate(addDays(endKey, 2)).toISOString(),
  };
}

export function formatDayLong(key: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    keyToUtcDate(key)
  );
}

export function formatDayShort(key: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" }).format(keyToUtcDate(key));
}

export function formatWeekday(key: string, style: "narrow" | "short" = "short"): string {
  return new Intl.DateTimeFormat(undefined, { weekday: style, timeZone: "UTC" }).format(keyToUtcDate(key));
}

export function formatDayOfMonth(key: string): string {
  return String(keyToUtcDate(key).getUTCDate());
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function relativeDayLabel(key: string, today: string): string {
  const d = diffDays(key, today);
  if (d === 0) return "Today";
  if (d === -1) return "Yesterday";
  if (d === 1) return "Tomorrow";
  return formatDayLong(key);
}
