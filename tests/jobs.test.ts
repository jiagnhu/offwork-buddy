import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  archiveJob,
  jobState,
  listJobs,
  saveJob,
  setPaydayReceived,
  setPrimaryJob,
  settleAllJobs,
  withJob,
} from "../src/core/jobs";
import { setLeave } from "../src/core/ledger";
import { applyPlanAction } from "../src/core/plans";
import { fixture, rule } from "./fixtures";
import { parseState } from "../src/shared/schema";
import { emptyChat } from "../src/shared/chat";
import { loadState, saveState } from "../src/main/store";
import { exportFullBackup, importFullBackup, validateBackup } from "../src/main/backup";
import { freezeLedgerQuotes } from "../src/core/work-income";
import type { JobInput } from "../src/shared/model";

const now = new Date("2026-01-23T19:00:00+08:00");
const input: JobInput = {
  name: "设计兼职",
  currency: "USD",
  color: "#6860db",
  startDate: "2026-01-05",
  rule: {
    ...rule,
    mode: "biweekly",
    amount: "1400",
    periodStart: "2026-01-05",
    payDate: "2026-01-23",
  },
};

it("applies revised fixed pay on the next cycle and replaces a pending change", () => {
  const day = new Date("2026-01-08T12:00:00+08:00");
  let state = saveJob(fixture(), input, day);
  const id = state.otherJobs[0].id;
  for (const amount of ["1800", "2000"])
    state = saveJob(
      state,
      { ...input, id, rule: { ...input.rule, amount } },
      day,
    );
  expect(
    jobState(state, id).rules.map((r) => [r.effectiveFrom, r.amount]),
  ).toEqual([
    ["2026-01-05", "1400"],
    ["2026-01-19", "2000"],
  ]);
});

it("keeps the two ledgers, plans, and unpaid leave independent across a primary switch and backup", () => {
  const original = settleAllJobs(fixture(), now);
  let s = saveJob(original, input, now);
  const id = s.otherJobs[0].id,
    d = "2026-01-05";
  expect(s.otherJobs[0].ledger[d].amountCents).toBe(14000);
  s = withJob(s, id, (one) =>
    setLeave(one, d, [{ start: 540, end: 720 }], now),
  );
  expect(s.otherJobs[0].ledger[d].amountCents).toBe(8750);
  s = withJob(s, id, (one) =>
    applyPlanAction(one, d, { type: "add", id: "p", text: "交图" }, now),
  );
  expect(s.ledger).toEqual(original.ledger);
  expect(s.plans).toEqual({});
  const switched = validateBackup(setPrimaryJob(s, id));
  expect(switched.primaryJob.currency).toBe("USD");
  expect(switched.ledger[d].amountCents).toBe(8750);
  expect(switched.plans[d][0].text).toBe("交图");
  const restored = setPrimaryJob(switched, original.primaryJob.id);
  expect(restored.ledger).toEqual(parseState(original).ledger);
  expect(restored.otherJobs[0].id).toBe(id);
  expect(listJobs(restored).map((j) => j.name)).toEqual(["主业", "设计兼职"]);
  expect(() => saveJob(s, { ...input, id, currency: "CNY" }, now)).toThrow(
    "币种",
  );
});

it("ends accrual on the inclusive end date and lets a later payday be marked without another earning", () => {
  const atEnd = new Date("2026-01-17T10:00:00+08:00");
  let s = saveJob(fixture(), input, atEnd);
  const id = s.otherJobs[0].id;
  s = archiveJob(s, id, "2026-01-16", atEnd);
  s = settleAllJobs(s, now);
  const before = jobState(s, id);
  expect(Object.keys(before.ledger).sort().at(-1)).toBe("2026-01-16");
  expect(
    Object.values(before.ledger).reduce((sum, e) => sum + e.amountCents, 0),
  ).toBe(140000);
  expect(() => setPaydayReceived(s, id, "2026-01-24", true, now)).toThrow();
  s = setPaydayReceived(s, id, "2026-01-23", true, now);
  expect(jobState(s, id).ledger).toEqual(before.ledger);
  expect(jobState(s, id).primaryJob.receivedPaydays["2026-01-23"]).toBe(true);
});

it("keeps v3 original bytes and migrates existing amounts, plans, and leave without recalculation", async () => {
  const d = await mkdtemp(path.join(tmpdir(), "buddy-jobs-upgrade-"));
  const { primaryJob, otherJobs, personalPlans, ...legacy } = settleAllJobs(
    fixture(),
    now,
  );
  const date = "2026-01-05";
  legacy.ledger[date].amountCents = 12345;
  legacy.leaves = { [date]: [{ start: 540, end: 570 }] };
  legacy.plans[date] = [{ id: "preserve", text: "原任务", completed: true }];
  const raw = JSON.stringify({ ...legacy, schemaVersion: 3 });
  try {
    await writeFile(path.join(d, "state.json"), raw);
    const { state } = await loadState(d);
    expect(await readFile(path.join(d, "state.pre-v4.json"), "utf8")).toBe(raw);
    expect(state.primaryJob.currency).toBe("CNY");
    expect(state.ledger[date].amountCents).toBe(12345);
    expect(state.plans).toEqual(legacy.plans);
    expect(state.leaves).toEqual(legacy.leaves);
    await saveState(d, state);
    expect((await loadState(d)).state).toEqual(state);
  } finally {
    await rm(d, { recursive: true, force: true });
  }
});

it("durably freezes verified historical quotes when restoring either backup format", async () => {
  const d = await mkdtemp(path.join(tmpdir(), "buddy-jobs-import-"));
  const state = saveJob(fixture(), input, now);
  const date = "2026-01-05";
  state.fxBook = { rates: { [date]: 7.05 }, coverage: { [date]: date } };
  try {
    for (const backup of [state, exportFullBackup(state, emptyChat())]) {
      const restored = await importFullBackup(d, backup, s => freezeLedgerQuotes(s, "2026-01-23"));
      const entry = restored.state.otherJobs[0].ledger[date];
      expect(entry.fxQuote).toEqual({ rate: 7.05, rateDate: date, estimated: false });
      expect((await loadState(d)).state.otherJobs[0].ledger[date].fxQuote).toEqual(entry.fxQuote);
      entry.fxQuote!.estimated = true;
      expect(() => validateBackup(restored.state)).toThrow();
      entry.fxQuote = { rate: 7.05, rateDate: "2026-01-06", estimated: false };
      expect(() => validateBackup(restored.state)).toThrow();
    }
  } finally {
    await rm(d, { recursive: true, force: true });
  }
});
