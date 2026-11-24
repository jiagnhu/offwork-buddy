import type { LedgerEntry, State, RuleVersion } from "../shared/model";
import { countScheduledDays } from "./calendar";
import { calculateDayDetail } from "./earnings";
import { ruleForDate } from "./ledger";
export function explainLedger(entry: LedgerEntry) {
  const normalDenominator = countScheduledDays(
    entry.date.slice(0, 7),
    entry.rule,
  );
  return {
    amountCents: entry.amountCents,
    storedDenominator: entry.workdayCount,
    normalDenominator,
    algorithm: entry.algorithm ?? ("historical" as const),
    differs:
      entry.rule.mode === "monthly" && entry.workdayCount !== normalDenominator,
  };
}
export type EarningsDetail =
  | { kind: "unconfigured"; date: string }
  | {
      kind: "day";
      date: string;
      rule: RuleVersion;
      detail: ReturnType<typeof calculateDayDetail>;
    }
  | {
      kind: "historical";
      date: string;
      entry: LedgerEntry;
      explanation: ReturnType<typeof explainLedger>;
    };
export function earningsDetail(
  state: State,
  date: string,
  now: Date,
): EarningsDetail {
  const entry = state.ledger[date];
  if (entry)
    return {
      kind: "historical",
      date,
      entry,
      explanation: explainLedger(entry),
    };
  const rule =
    state.configured && date >= state.startDate
      ? ruleForDate(state, date)
      : undefined;
  return rule
    ? {
        kind: "day",
        date,
        rule,
        detail: calculateDayDetail(
          date,
          now,
          rule,
          state.calendar,
          state.overrides,
          state.leaves?.[date],
          state.ledger,
        ),
      }
    : { kind: "unconfigured", date };
}
