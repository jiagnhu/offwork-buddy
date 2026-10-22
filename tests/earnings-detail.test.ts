import { it, expect } from "vitest";
import { calculateDay, calculateDayDetail } from "../src/core/earnings";
import { explainLedger } from "../src/core/earnings-detail";
import { fixture, rule } from "./fixtures";
import { settleThrough } from "../src/core/ledger";
it("detail shares exact unrounded budget and elapsed time with live earnings", () => {
  const r = {
    ...rule,
    mode: "monthly" as const,
    amount: "16000",
    schedule: "alternating" as const,
    bigWeekMonday: "2026-10-19",
    start: 570,
    end: 1110,
    breakStart: 720,
    breakEnd: 810,
  };
  const now = new Date("2026-10-22T12:00:00+08:00");
  const d = calculateDayDetail("2026-10-22", now, r, {}, {});
  expect(d.denominator).toBe(24);
  expect(d.totalSeconds).toBe(27000);
  expect(d.elapsedSeconds).toBe(9000);
  expect(d.progress).toEqual(calculateDay("2026-10-22", now, r, {}, {}));
  expect(d.progress.earnedCents).toBe(22222);
  expect(
    calculateDay("2026-10-22", new Date("2026-10-22T18:30:00+08:00"), r, {}, {})
      .earnedCents * 3,
  ).toBe(200001);
});
it("historical explanation preserves stored cents and never invents provenance", () => {
  const s = fixture();
  s.rules[0] = {
    ...s.rules[0],
    mode: "monthly",
    amount: "16000",
    schedule: "alternating",
    bigWeekMonday: "2026-10-19",
  };
  s.startDate = "2026-10-19";
  const e = settleThrough(s, new Date("2026-10-20T10:00:00+08:00")).ledger[
    "2026-10-19"
  ];
  delete e.algorithm;
  e.workdayCount = 19;
  e.amountCents = 84211;
  expect(explainLedger(e)).toMatchObject({
    amountCents: 84211,
    storedDenominator: 19,
    normalDenominator: 24,
    algorithm: "historical",
    differs: true,
  });
  e.workdayCount = 24;
  expect(explainLedger(e).algorithm).toBe("historical");
});
