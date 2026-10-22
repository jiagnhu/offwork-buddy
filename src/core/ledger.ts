import type { DateKey, RuleInput, RuleVersion, State } from "../shared/model";
import { addDays, dateKey, validDate } from "./date";
import { calculateDay } from "./earnings";
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
    result.ledger[d] = {
      algorithm: "normal-schedule-v1",
      date: d,
      ruleId: rule.id,
      workday: day.workday,
      amountCents: calculateDay(d, now, rule, state.calendar, state.overrides)
        .earnedCents,
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
