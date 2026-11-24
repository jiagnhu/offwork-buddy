import type { State } from "../shared/model";
import { calendarIncome } from "./calendar-income";
import { calculateDay } from "./earnings";
import { ruleForDate } from "./ledger";
import { addDays, dateKey } from "./date";
import {
  inJobPeriod,
  jobPaydayPeriods,
  jobState,
  listJobs,
  withJob,
} from "./jobs";
import { emptyFxBook, quoteForDate, toCnyCents } from "./fx";

const noRates = emptyFxBook();

function converted(
  state: State,
  currency: "USD" | "CNY",
  date: string,
  today: string,
  nativeCents: number,
) {
  const quote =
    currency === "USD"
      ? (state.ledger[date]?.fxQuote ??
        quoteForDate(state.fxBook ?? noRates, date, today))
      : null;
  // An incomplete historical rate series must not silently substitute an older rate.
  const usable = quote && (date >= today || !quote.estimated) ? quote : null;
  return {
    nativeCents,
    currency,
    cnyCents:
      currency === "CNY" || nativeCents === 0
        ? nativeCents
        : usable
          ? toCnyCents(nativeCents, usable.rate)
          : null,
    rate: usable?.rate ?? null,
    rateDate: usable?.rateDate ?? null,
    provisional: usable?.estimated ?? false,
  };
}

export function jobDayIncome(
  state: State,
  jobId: string,
  date: string,
  now: Date,
) {
  const job = listJobs(state).find((j) => j.id === jobId);
  if (!job) throw new Error("找不到这份工作");
  const scoped = jobState(state, jobId);
  const day = inJobPeriod(job, date)
    ? calendarIncome(scoped, date, now)
    : { kind: "before-start" as const, amountCents: 0 };
  return {
    kind: day.kind,
    ...converted(scoped, job.currency, date, dateKey(now), day.amountCents),
  };
}

export function combinedDayIncome(state: State, date: string, now: Date) {
  let cnyCents = 0,
    pendingUsdCents = 0;
  for (const job of listJobs(state)) {
    const day = jobDayIncome(state, job.id, date, now);
    if (day.cnyCents === null) pendingUsdCents += day.nativeCents;
    else cnyCents += day.cnyCents;
  }
  return { cnyCents, pendingUsdCents };
}

// Calculated once per immutable state in the main process, outside the clock tick.
export function settledJobTotals(state: State, today: string) {
  let settledCny = 0,
    settledPendingUsd = 0;
  const workedDates = new Set<string>();
  for (const job of listJobs(state)) {
    const scoped = jobState(state, job.id);
    for (const entry of Object.values(scoped.ledger)) {
      if (entry.date >= today) continue;
      const income = converted(
        scoped,
        job.currency,
        entry.date,
        today,
        entry.amountCents,
      );
      if (income.cnyCents === null) settledPendingUsd += income.nativeCents;
      else settledCny += income.cnyCents;
      if (entry.workday) workedDates.add(entry.date);
    }
  }
  return { settledCny, settledPendingUsd, days: workedDates.size };
}

export function freezeLedgerQuotes(state: State, today: string): State {
  if (!state.fxBook) return state;
  let result = state;
  for (const job of listJobs(state)) {
    if (job.currency !== "USD") continue;
    const scoped = jobState(result, job.id);
    let ledger = scoped.ledger;
    for (const entry of Object.values(scoped.ledger)) {
      if (entry.fxQuote || entry.date >= today || !entry.amountCents) continue;
      const quote = quoteForDate(state.fxBook, entry.date, today);
      if (!quote || quote.estimated) continue;
      if (ledger === scoped.ledger) ledger = { ...ledger };
      ledger[entry.date] = { ...entry, fxQuote: quote };
    }
    if (ledger !== scoped.ledger)
      result = withJob(result, job.id, (s) => ({ ...s, ledger }));
  }
  return result;
}

export function jobPayday(state: State, jobId: string, date: string) {
  const job = listJobs(state).find((j) => j.id === jobId);
  if (!job) return null;
  const scoped = jobState(state, job.id);
  const periods = jobPaydayPeriods(scoped, date);
  if (!periods.length) return null;
  let expectedCents = 0,
    applies = false;
  let start = periods[0].start,
    end = periods[0].end;
  for (const period of periods) {
    if (period.start < start) start = period.start;
    if (period.end > end) end = period.end;
    for (let d = period.start; d <= period.end; d = addDays(d, 1)) {
      if (!inJobPeriod(job, d)) continue;
      const entry = scoped.ledger[d];
      const active = entry?.rule ?? ruleForDate(scoped, d);
      if (active?.id !== period.rule.id) continue;
      applies = true;
      expectedCents +=
        entry?.amountCents ??
        calculateDay(
          d,
          new Date(d + "T12:00:00+08:00"),
          active,
          scoped.calendar,
          scoped.overrides,
          scoped.leaves?.[d],
          scoped.ledger,
        ).budgetCents;
    }
  }
  return applies
    ? {
        ...periods[0],
        start,
        end,
        expectedCents,
        received: !!job.receivedPaydays[date],
      }
    : null;
}
