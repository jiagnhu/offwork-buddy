import type { DateKey } from "../shared/model";
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function dateKey(now: Date, zone = "Asia/Shanghai"): DateKey {
  let formatter = dateFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (dateFormatters.size >= 16) dateFormatters.clear();
    dateFormatters.set(zone, formatter);
  }
  return formatter.format(now);
}
export function dayNumber(date: DateKey): number {
  return Date.parse(date + "T00:00:00Z") / 86400000;
}
export function addDays(date: DateKey, n: number): DateKey {
  return new Date((dayNumber(date) + n) * 86400000).toISOString().slice(0, 10);
}
export function weekday(date: DateKey): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(dayNumber(date)) &&
    new Date(dayNumber(date) * 86400000).toISOString().slice(0, 10) === date &&
    date >= "2000-01-01" &&
    date <= "2099-12-31"
  );
}
export function monthDates(month: string): DateKey[] {
  const result: DateKey[] = [];
  for (let d = month + "-01"; d.startsWith(month); d = addDays(d, 1))
    result.push(d);
  return result;
}
export function secondsIntoDay(now: Date): number {
  const parts = clockFormatter.format(now).split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
