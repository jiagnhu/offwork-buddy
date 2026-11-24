import { describe, expect, it } from "vitest";
import { fixture, rule } from "./fixtures";
import {
  archiveJob,
  jobState,
  setPaydayReceived,
  settleAllJobs,
  withJob,
} from "../src/core/jobs";
import { recalculateRange, setLeave } from "../src/core/ledger";
import {
  combinedDayIncome,
  freezeLedgerQuotes,
  jobDayIncome,
  jobPayday,
  settledJobTotals,
} from "../src/core/work-income";
import type { RuleVersion, State } from "../src/shared/model";

const start = "2026-11-02";
const payday = "2026-11-20";
const sideRule: RuleVersion = {
  ...rule,
  id: "side-rule",
  effectiveFrom: start,
  mode: "biweekly",
  amount: "1400",
  periodStart: start,
  payDate: payday,
};
const at = (date: string) => new Date(date + "T08:00:00+08:00");

function twoJobs(): State {
  return {
    ...fixture(),
    startDate: start,
    rules: [{ ...rule, effectiveFrom: start, amount: "600" }],
    otherJobs: [
      {
        id: "side",
        name: "兼职",
        currency: "USD",
        color: "#ffa000",
        configured: true,
        receivedPaydays: {},
        startDate: start,
        rules: [sideRule],
        ledger: {},
        plans: {},
        overrides: {},
        leaves: {},
      },
    ],
    fxBook: {
      rates: { "2026-11-02": 7.1, "2026-11-03": 7 },
      coverage: { "2026-11-02": "2026-11-03" },
    },
  };
}

describe("多份工作收入", () => {
  it("按收入日换算、同一天只计一个出勤日，尚无报价的美元单列", () => {
    const state = settleAllJobs(twoJobs(), at("2026-11-05"));
    expect(combinedDayIncome(state, start, at("2026-11-05"))).toEqual({
      cnyCents: 159400,
      pendingUsdCents: 0,
    });
    expect(settledJobTotals(state, "2026-11-04")).toEqual({
      settledCny: 317400,
      settledPendingUsd: 0,
      days: 2,
    });
    expect(combinedDayIncome(state, "2026-11-04", at("2026-11-05"))).toEqual({
      cnyCents: 60000,
      pendingUsdCents: 14000,
    });
    expect(
      jobDayIncome(state, "side", "2026-11-06", at("2026-11-05")),
    ).toMatchObject({
      nativeCents: 14000,
      cnyCents: 98000,
      provisional: true,
      rateDate: "2026-11-03",
    });
  });

  it("修改历史请假和重算保留原汇率，发薪日标记仅改变到账状态", () => {
    const now = at("2026-11-21");
    let state = freezeLedgerQuotes(settleAllJobs(twoJobs(), now), "2026-11-21");
    state.fxBook = { rates: { [start]: 8 }, coverage: { [start]: payday } };
    state = withJob(state, "side", (one) =>
      setLeave(one, start, [{ start: 540, end: 720 }], now),
    );
    state = withJob(state, "side", (one) =>
      recalculateRange(one, start, start, now),
    );
    expect(jobDayIncome(state, "side", start, now)).toMatchObject({
      nativeCents: 8750,
      cnyCents: 62125,
      rate: 7.1,
    });
    const original = settledJobTotals(state, "2026-11-21");
    expect(jobPayday(state, "side", payday)).toMatchObject({
      expectedCents: 134750,
      received: false,
    });
    state = setPaydayReceived(state, "side", payday, true, now);
    expect(jobPayday(state, "side", payday)?.received).toBe(true);
    expect(settledJobTotals(state, "2026-11-21")).toEqual(original);
  });

  it("入职和离职均在周期中间，最后一笔在离职后发放", () => {
    let state = twoJobs();
    state.otherJobs[0].startDate = "2026-11-05";
    state.otherJobs[0].rules = [{ ...sideRule, effectiveFrom: "2026-11-05" }];
    state = archiveJob(state, "side", "2026-11-09", at("2026-11-10"));
    expect(jobPayday(state, "side", payday)).toMatchObject({
      expectedCents: 42000,
      start,
      end: "2026-11-15",
    });
    expect(
      jobDayIncome(state, "side", "2026-11-10", at("2026-11-21")).nativeCents,
    ).toBe(0);
    expect(jobPayday(state, "side", "2026-12-04")).toBeNull();
  });

  it("已结算的工作日保持原额，剩余报酬在变更后的工作日分摊，请假独立扣减", () => {
    const now = at("2026-11-09");
    let state = settleAllJobs(twoJobs(), now);
    state = withJob(state, "side", (one) => ({
      ...one,
      overrides: { "2026-11-13": false },
    }));
    expect(jobState(state, "side").ledger[start].amountCents).toBe(14000);
    expect(jobDayIncome(state, "side", "2026-11-10", now).nativeCents).toBe(
      17500,
    );
    expect(jobPayday(state, "side", payday)?.expectedCents).toBe(140000);
    state = withJob(state, "side", (one) =>
      setLeave(one, start, [{ start: 540, end: 720 }], now),
    );
    expect(jobDayIncome(state, "side", "2026-11-10", now).nativeCents).toBe(
      17500,
    );
    expect(jobPayday(state, "side", payday)?.expectedCents).toBe(134750);
    state = settleAllJobs(state, at("2026-11-21"));
    expect(jobPayday(state, "side", payday)?.expectedCents).toBe(134750);
  });

  it("周末带薪假期按上一公布日换算，不扣请假，整期仍为固定薪资", () => {
    const holiday = "2026-11-07";
    let state = twoJobs();
    state.otherJobs[0].rules = [{ ...sideRule, official: true }];
    state.calendar["2026"] = {
      source: "test",
      updated: start,
      days: { "2026-11-06": false, [holiday]: false },
      paidHolidays: { [holiday]: "假日" },
    };
    state.fxBook = {
      rates: { "2026-11-06": 6.9 },
      coverage: { "2026-11-06": "2026-11-09" },
    };
    state = withJob(state, "side", (one) =>
      setLeave(one, holiday, [{ start: 540, end: 1080 }], at("2026-11-06")),
    );
    expect(jobDayIncome(state, "side", holiday, at(holiday)).nativeCents).toBe(
      14000,
    );
    expect(
      jobDayIncome(state, "side", holiday, at("2026-11-09")),
    ).toMatchObject({
      cnyCents: 96600,
      rateDate: "2026-11-06",
      provisional: false,
    });
    expect(jobPayday(state, "side", payday)?.expectedCents).toBe(140000);
  });

  it("发薪周期切换时，同一到账日可包含原周期欠付和新周期两笔收入", () => {
    const state = twoJobs();
    state.otherJobs[0].rules = [
      sideRule,
      {
        ...sideRule,
        id: "new-cycle",
        effectiveFrom: "2026-11-16",
        periodStart: "2026-11-16",
        payDate: payday,
        amount: "1800",
      },
    ];
    expect(jobPayday(state, "side", payday)).toMatchObject({
      start,
      end: "2026-11-29",
      expectedCents: 320000,
      received: false,
    });
    expect(jobPayday(state, "side", "2026-12-04")?.expectedCents).toBe(180000);
  });
});
