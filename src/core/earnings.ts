import Decimal from "decimal.js";
import type {
  CalendarData,
  DateKey,
  DayProgress,
  RuleVersion,
} from "../shared/model";
import { countScheduledDays, resolveDay } from "./calendar";
import { dateKey, secondsIntoDay } from "./date";
export const emptyProgress: DayProgress = {
  status: "unconfigured",
  countdownSeconds: 0,
  countdownTarget: "offwork",
  earnedCents: 0,
  budgetCents: 0,
  fraction: 0,
  calendarMissing: false,
};
export function calculateDayDetail(
  date: DateKey,
  now: Date,
  rule: RuleVersion,
  calendar: CalendarData,
  overrides: Record<DateKey, boolean>,
) {
  const info = resolveDay(date, rule, calendar, overrides);
  if (!info.workday && !info.paidHoliday)
    return {
      progress: {
        ...emptyProgress,
        status: "rest" as const,
        calendarMissing: info.calendarMissing,
      },
      denominator: null,
      totalSeconds: 0,
      elapsedSeconds: 0,
      dailyBudgetDecimal: "0",
      dayInfo: info,
    };
  const start = rule.start * 60,
    end = rule.end * 60;
  const bs = rule.breakStart === null ? end : rule.breakStart * 60,
    be = rule.breakEnd === null ? end : rule.breakEnd * 60;
  const total = end - start - (be - bs);
  const today = dateKey(now);
  const seconds = date < today ? 86400 : date > today ? 0 : secondsIntoDay(now);
  const elapsed =
    Math.max(0, Math.min(seconds, end) - start) -
    Math.max(0, Math.min(seconds, be) - bs);
  const fraction = info.paidHoliday
    ? date <= today
      ? 1
      : 0
    : total > 0
      ? Math.max(0, Math.min(1, elapsed / total))
      : 0;
  let budget = new Decimal(rule.amount);
  let denominator: number | null = null;
  if (rule.mode === "monthly") {
    const count = countScheduledDays(date.slice(0, 7), rule);
    denominator = count;
    budget = count ? budget.div(count) : new Decimal(0);
  }
  if (rule.mode === "hourly") budget = budget.mul(total).div(3600);
  const status: DayProgress["status"] =
    seconds < start
      ? "before"
      : seconds >= end
        ? "finished"
        : seconds >= bs && seconds < be
          ? "break"
          : "working";
  const progress: DayProgress = {
    status: info.paidHoliday ? "rest" : status,
    countdownTarget:
      seconds < bs && rule.breakStart !== null
        ? "lunch"
        : status === "break"
          ? "resume"
          : "offwork",
    countdownSeconds: info.paidHoliday
      ? 0
      : Math.max(
          0,
          (seconds < bs && rule.breakStart !== null
            ? bs
            : status === "break"
              ? be
              : end) - seconds,
        ),
    budgetCents: budget
      .mul(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber(),
    earnedCents: budget
      .mul(100)
      .mul(fraction)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber(),
    fraction,
    calendarMissing: info.calendarMissing,
  };
  return {
    progress,
    denominator,
    totalSeconds: info.paidHoliday ? 0 : total,
    elapsedSeconds: info.paidHoliday ? 0 : Math.round(fraction * total),
    dailyBudgetDecimal: budget.toString(),
    dayInfo: info,
  };
}
export function calculateDay(
  ...args: Parameters<typeof calculateDayDetail>
): DayProgress {
  return calculateDayDetail(...args).progress;
}
