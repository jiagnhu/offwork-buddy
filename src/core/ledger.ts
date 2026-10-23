import Decimal from "decimal.js";
import { normalizeLeave, leaveSeconds } from "./leave";
import type { LeaveInterval } from "../shared/model";
import type { DateKey, RuleInput, RuleVersion, State } from "../shared/model";
import { addDays, dateKey, validDate } from "./date";
import { calculateDayDetail } from "./earnings";
import { countScheduledDays, resolveDay } from "./calendar";
export function ruleForDate(
  state: State,
  date: DateKey,
): RuleVersion | undefined {
  return state.rules
    .filter((r) => r.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export function settleThrough(state: State, now: Date): State {
  if (!state.configured) return state;
  const result = structuredClone(state);
  const today = dateKey(now);
  for (let d = state.startDate; d < today; d = addDays(d, 1)) {
    if (result.ledger[d]) continue;
    const rule = ruleForDate(state, d);
    if (!rule) continue;
    const day = resolveDay(d, rule, state.calendar, state.overrides);
    const detail = calculateDayDetail(
      d,
      now,
      rule,
      state.calendar,
      state.overrides,
      state.leaves?.[d],
    );
    result.ledger[d] = {
      baseBudgetDecimal: detail.dailyBudgetDecimal,
      leaveDeductionCents: detail.leaveDeductionCents,
      leaveMinutes: detail.leaveMinutes,
      algorithm: "normal-schedule-v1",
      date: d,
      ruleId: rule.id,
      workday: day.workday,
      amountCents: detail.progress.earnedCents,
      rule: structuredClone(rule),
      calendarSnapshot: day,
      workdayCount: countScheduledDays(d.slice(0, 7), rule),
    };
  }
  return result;
}
export function scheduleRule(state: State, input: RuleInput, now: Date): State {
  const effectiveFrom = state.configured
    ? addDays(dateKey(now), 1)
    : state.startDate;
  const result = structuredClone(state);
  result.rules = result.rules.filter((r) => r.effectiveFrom !== effectiveFrom);
  result.rules.push({ ...input, id: crypto.randomUUID(), effectiveFrom });
  result.rules.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  result.configured = true;
  return result;
}
export function recalculateRange(
  state: State,
  from: DateKey,
  to: DateKey,
  now: Date,
): State {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    from < state.startDate ||
    to >= dateKey(now)
  )
    throw new Error("重算范围须在累计开始日期至昨天之间");
  const result = structuredClone(state);
  for (const d of Object.keys(result.ledger))
    if (d >= from && d <= to) delete result.ledger[d];
  return settleThrough(result, now);
}

export function setLeave(
  state: State,
  date: DateKey,
  intervals: LeaveInterval[],
  now: Date,
): State {
  if (
    !validDate(date) ||
    !state.configured ||
    date < state.startDate ||
    !ruleForDate(state, date)
  )
    throw new Error("请先设置工资，且请假日期不能早于入职日期");
  const normalized = normalizeLeave(intervals);
  const result = settleThrough(structuredClone(state), now);
  result.leaves ??= {};
  if (normalized.length) result.leaves[date] = normalized;
  else delete result.leaves[date];
  const entry = result.ledger[date];
  if (entry) {
    const base = entry.amountCents + (entry.leaveDeductionCents ?? 0);
    const r = entry.rule;
    const total =
      (r.end - r.start - ((r.breakEnd ?? r.end) - (r.breakStart ?? r.end))) *
      60;
    const excluded =
      entry.calendarSnapshot.workday && !entry.calendarSnapshot.paidHoliday
        ? leaveSeconds(r, normalized)
        : 0;
    entry.amountCents = (
      entry.baseBudgetDecimal
        ? new Decimal(entry.baseBudgetDecimal).mul(100)
        : new Decimal(base)
    )
      .mul(total - excluded)
      .div(total)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
    entry.leaveDeductionCents = base - entry.amountCents;
    entry.leaveMinutes = excluded / 60;
  }
  return result;
}
