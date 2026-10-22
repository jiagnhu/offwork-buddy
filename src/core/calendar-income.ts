import type { State } from "../shared/model";
import { dateKey } from "./date";
import { ruleForDate } from "./ledger";
import { calculateDay } from "./earnings";
export function calendarIncome(state: State, date: string, now: Date) {
  if (!state.configured || date < state.startDate)
    return { kind: "before-start" as const, amountCents: 0 };
  const entry = state.ledger[date];
  if (entry)
    return { kind: "settled" as const, amountCents: entry.amountCents };
  const rule = ruleForDate(state, date);
  if (!rule) return { kind: "unconfigured" as const, amountCents: 0 };
  const progress = calculateDay(
    date,
    now,
    rule,
    state.calendar,
    state.overrides,
  );
  return date === dateKey(now)
    ? { kind: "today" as const, amountCents: progress.earnedCents }
    : { kind: "estimated" as const, amountCents: progress.budgetCents };
}
