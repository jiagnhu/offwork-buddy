import type { JobData, JobMeta, JobProfile, State } from "../shared/model";
import { jobInputSchema, ruleSchema, dateSchema } from "../shared/schema";
import { dateKey } from "./date";
import { nextRuleDate, settleThrough } from "./ledger";
import { biweeklyPayday } from "./biweekly";

function metadata(job: JobMeta): JobMeta {
  const { id, name, color, currency, endDate, receivedPaydays } = job;
  return { id, name, color, currency, endDate, receivedPaydays };
}

export function primaryJob(state: State): JobProfile {
  return { ...state.primaryJob, startDate: state.startDate };
}

export function listJobs(state: State): JobProfile[] {
  return [
    primaryJob(state),
    ...state.otherJobs.map((j) => ({ ...metadata(j), startDate: j.startDate })),
  ];
}

export function inJobPeriod(job: JobProfile, date: string): boolean {
  return date >= job.startDate && (!job.endDate || date <= job.endDate);
}

function contents(state: State) {
  const { configured, startDate, rules, overrides, leaves, plans, ledger } =
    state;
  return { configured, startDate, rules, overrides, leaves, plans, ledger };
}

export function jobState(
  state: State,
  id: string = state.primaryJob.id,
): State {
  if (id === state.primaryJob.id) return { ...state, otherJobs: [] };
  const job = state.otherJobs.find((j) => j.id === id);
  if (!job) throw new Error("工作不存在，请刷新后重试");
  return {
    ...state,
    configured: job.configured,
    startDate: job.startDate,
    rules: job.rules,
    overrides: job.overrides,
    leaves: job.leaves,
    plans: job.plans,
    ledger: job.ledger,
    primaryJob: metadata(job),
    otherJobs: [],
  };
}

export function withJob(
  state: State,
  id: string | undefined,
  update: (scoped: State) => State,
): State {
  const next = update(jobState(state, id));
  if (next.primaryJob.id === state.primaryJob.id)
    return {
      ...state,
      ...contents(next),
      primaryJob: next.primaryJob,
      growth: next.growth,
    };
  const job: JobData = { ...metadata(next.primaryJob), ...contents(next) };
  return {
    ...state,
    otherJobs: state.otherJobs.map((j) => (j.id === job.id ? job : j)),
    growth: next.growth,
  };
}

export function settleAllJobs(state: State, now: Date): State {
  return listJobs(state).reduce(
    (next, job) =>
      withJob(next, job.id, (scoped) => settleThrough(scoped, now)),
    state,
  );
}

function checkEnd(state: State, startDate: string, endDate?: string) {
  if (!endDate) return;
  dateSchema.parse(endDate);
  if (endDate < startDate) throw new Error("工作结束日期不能早于开始日期");
  if (
    Object.values(state.ledger).some(
      (e) => e.date > endDate && e.amountCents > 0,
    )
  )
    throw new Error(
      "结束日期之后已有收入记录，请选择最后一个有收入的日期或更晚的日期",
    );
}

function trimEmptyEntries(scoped: State, endDate?: string) {
  if (!endDate) return scoped.ledger;
  return Object.fromEntries(
    Object.entries(scoped.ledger).filter(([date]) => date <= endDate),
  );
}

export function saveJob(state: State, raw: unknown, now: Date): State {
  const input = jobInputSchema.parse(raw);
  const id =
    input.id ?? (state.configured ? crypto.randomUUID() : state.primaryJob.id);
  const meta = {
    id,
    name: input.name,
    color: input.color,
    currency: input.currency,
    endDate: input.endDate,
  };
  const existing =
    id === state.primaryJob.id || state.otherJobs.some((j) => j.id === id);
  if (input.id && !existing) throw new Error("工作不存在，请刷新后重试");
  const scoped = existing ? jobState(state, id) : undefined;
  if (scoped?.configured && scoped.primaryJob.currency !== input.currency)
    throw new Error("已有工作的币种不能更改，请新增一份工作");
  if (scoped?.configured && input.startDate > scoped.startDate)
    throw new Error("已累计后只能向前扩展开始日期");
  if (input.endDate && input.endDate < input.startDate)
    throw new Error("工作结束日期不能早于开始日期");
  const rule = ruleSchema.parse({
    ...input.rule,
    id: crypto.randomUUID(),
    effectiveFrom: input.startDate,
  });
  if (!existing) {
    const job: JobData = {
      ...meta,
      startDate: input.startDate,
      receivedPaydays: {},
      configured: true,
      rules: [rule],
      plans: {},
      ledger: {},
      overrides: {},
      leaves: {},
    };
    state = { ...state, otherJobs: [...state.otherJobs, job] };
    return withJob(state, id, (one) => settleThrough(one, now));
  }
  return withJob(state, id, (one) => {
    checkEnd(one, input.startDate, input.endDate);
    const rules = [...one.rules];
    if (rules.length && input.startDate < one.startDate)
      rules[0] = { ...rules[0], effectiveFrom: input.startDate };
    const from = nextRuleDate(
      { ...one, startDate: input.startDate, rules },
      now,
    );
    const previous = rules.filter((r) => r.effectiveFrom <= from).at(-1);
    const same =
      previous &&
      Object.entries(rule)
        .filter(([k]) => k !== "id" && k !== "effectiveFrom")
        .every(([k, v]) => previous[k as keyof typeof previous] === v);
    const nextRules = same
      ? rules
      : [
          ...rules.filter((r) => r.effectiveFrom < from),
          { ...rule, effectiveFrom: from },
        ].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    return settleThrough(
      {
        ...one,
        configured: true,
        startDate: input.startDate,
        primaryJob: {
          ...meta,
          receivedPaydays: one.primaryJob.receivedPaydays,
        },
        rules: nextRules,
        ledger: trimEmptyEntries(one, input.endDate),
      },
      now,
    );
  });
}

export function archiveJob(
  state: State,
  id: string,
  endDate: string,
  now: Date,
): State {
  dateSchema.parse(endDate);
  return withJob(state, id, (one) => {
    checkEnd(one, one.startDate, endDate);
    return settleThrough(
      {
        ...one,
        primaryJob: { ...one.primaryJob, endDate },
        ledger: trimEmptyEntries(one, endDate),
      },
      now,
    );
  });
}

export function setPrimaryJob(state: State, id: string): State {
  if (state.primaryJob.id === id) return state;
  const selected = jobState(state, id);
  const old: JobData = { ...state.primaryJob, ...contents(state) };
  return {
    ...state,
    ...contents(selected),
    primaryJob: selected.primaryJob,
    otherJobs: state.otherJobs.map((j) => (j.id === id ? old : j)),
  };
}

/** Paydays can fall after employment ends or a new salary rule takes effect. */
export function jobPaydayPeriods(scoped: State, date: string) {
  const periods = [];
  for (let i = scoped.rules.length - 1; i >= 0; i--) {
    const rule = scoped.rules[i];
    if (rule.mode !== "biweekly" || !rule.periodStart || !rule.payDate)
      continue;
    const period = biweeklyPayday(date, rule.periodStart, rule.payDate);
    const until = scoped.rules[i + 1]?.effectiveFrom;
    if (
      period &&
      period.end >= scoped.startDate &&
      period.end >= rule.effectiveFrom &&
      (!scoped.primaryJob.endDate ||
        period.start <= scoped.primaryJob.endDate) &&
      (!until || period.start < until)
    )
      periods.push({ ...period, rule });
  }
  return periods;
}

export function jobPayday(scoped: State, date: string) {
  return jobPaydayPeriods(scoped, date)[0] ?? null;
}

export function setPaydayReceived(
  state: State,
  id: string,
  date: string,
  received: boolean,
  now: Date,
): State {
  dateSchema.parse(date);
  return withJob(state, id, (scoped) => {
    if (date > dateKey(now) || !jobPayday(scoped, date))
      throw new Error("只能标记今天或过去的发薪日");
    const receivedPaydays = { ...scoped.primaryJob.receivedPaydays };
    if (received) receivedPaydays[date] = true;
    else delete receivedPaydays[date];
    return { ...scoped, primaryJob: { ...scoped.primaryJob, receivedPaydays } };
  });
}
