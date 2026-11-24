import Decimal from "decimal.js";
import type { CalendarData, LedgerEntry, RuleVersion } from "../shared/model";
import { resolveDay } from "./calendar";
import { addDays, dayNumber } from "./date";

function cycleIndex(date: string, anchor: string): number {
  return Math.floor((dayNumber(date) - dayNumber(anchor)) / 14);
}

export function biweeklyPeriod(
  date: string,
  cycleStart: string,
  firstPayday: string,
) {
  const offset = 14 * cycleIndex(date, cycleStart);
  const start = addDays(cycleStart, offset);
  return {
    start,
    end: addDays(start, 13),
    payday: addDays(firstPayday, offset),
  };
}

export function biweeklyPayday(
  date: string,
  cycleStart: string,
  firstPayday: string,
) {
  const offset = 14 * cycleIndex(date, firstPayday);
  if (addDays(firstPayday, offset) !== date) return null;
  const start = addDays(cycleStart, offset);
  return { start, end: addDays(start, 13), payday: date };
}

export function biweeklyAllocation(
  date: string,
  cycleStart: string,
  amount: string,
  rule: RuleVersion,
  calendar: CalendarData,
  overrides: Record<string, boolean>,
  ledger: Record<string, LedgerEntry> = {},
) {
  const start = addDays(cycleStart, cycleIndex(date, cycleStart) * 14);
  let settledDays = 0;
  let settledGross = 0;
  let openDays = 0;
  let index = -1;
  for (let offset = 0; offset < 14; offset++) {
    const day = addDays(start, offset);
    const entry = ledger[day];
    if (entry?.ruleId === rule.id) {
      // Preserve the original gross allocation so leave reduces pay once.
      if (entry.workday || entry.calendarSnapshot.paidHoliday) settledDays++;
      settledGross += entry.amountCents + (entry.leaveDeductionCents ?? 0);
      continue;
    }
    const info = resolveDay(day, rule, calendar, overrides);
    if (info.workday || info.paidHoliday) {
      if (day === date) index = openDays;
      openDays++;
    }
  }
  const days = settledDays + openDays;
  const settled = ledger[date];
  if (settled?.ruleId === rule.id)
    return {
      days: settled.workdayCount,
      cents: settled.amountCents + (settled.leaveDeductionCents ?? 0),
    };
  if (index < 0) return { days, cents: 0 };
  // Give the first few paid days one extra cent so a full cycle sums exactly.
  const totalCents = new Decimal(amount)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const remaining = Math.max(0, totalCents - settledGross);
  const cents =
    Math.floor(remaining / openDays) + Number(index < remaining % openDays);
  return { days, cents };
}
