import type {
  CalendarData,
  DateKey,
  DayInfo,
  RuleVersion,
} from "../shared/model";
import { dayNumber, weekday, monthDates } from "./date";
export function mergeBundledCalendar(
  bundled: CalendarData,
  saved: CalendarData,
): CalendarData {
  const result = { ...bundled, ...saved };
  for (const [year, data] of Object.entries(saved)) {
    if (
      data.paidHolidays === undefined &&
      data.source === bundled[year]?.source
    ) {
      result[year] = {
        ...data,
        paidHolidays: Object.fromEntries(
          Object.entries(bundled[year].paidHolidays ?? {}).filter(
            ([date]) => data.days[date] === false,
          ),
        ),
      };
    }
  }
  return result;
}
export function resolveDay(
  date: DateKey,
  rule: RuleVersion,
  calendar: CalendarData,
  overrides: Record<DateKey, boolean>,
): DayInfo {
  const year = calendar[date.slice(0, 4)];
  const calendarMissing = rule.official && !year;
  if (Object.hasOwn(overrides, date))
    return { workday: overrides[date], source: "manual", calendarMissing };
  if (rule.official && year && Object.hasOwn(year.days, date))
    return {
      workday: year.days[date],
      source: "official",
      calendarMissing,
      ...(!year.days[date] && year.paidHolidays?.[date]
        ? { paidHoliday: year.paidHolidays[date] }
        : {}),
    };
  const day = weekday(date);
  let workday = day !== 0 && day !== 6;
  if (rule.schedule === "single") workday = day !== rule.restDay;
  if (rule.schedule === "alternating" && day === 6)
    workday =
      Math.floor((dayNumber(date) - dayNumber(rule.bigWeekMonday)) / 7) % 2 ===
      0;
  return { workday, source: "schedule", calendarMissing };
}
export function countWorkdays(
  month: string,
  rule: RuleVersion,
  calendar: CalendarData,
  overrides: Record<DateKey, boolean>,
): number {
  return monthDates(month).filter(
    (d) => resolveDay(d, rule, calendar, overrides).workday,
  ).length;
}
// Baseline schedule only: holidays, makeup days and personal overrides must not inflate daily pay.
export function countScheduledDays(month: string, rule: RuleVersion): number {
  return countWorkdays(month, { ...rule, official: false }, {}, {});
}
