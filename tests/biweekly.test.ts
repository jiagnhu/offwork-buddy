import { expect, it } from "vitest";
import {
  biweeklyAllocation,
  biweeklyPayday,
  biweeklyPeriod,
} from "../src/core/biweekly";
import { addDays } from "../src/core/date";
import { rule } from "./fixtures";

it("uses fourteen-day cycles for accrual and offsets delayed paydays independently", () => {
  const start = "2026-11-02";
  const payday = "2026-11-20";
  const period = { start, end: "2026-11-15", payday };
  expect(biweeklyPeriod("2026-11-15", start, payday)).toEqual(period);
  expect(biweeklyPeriod("2026-11-01", start, payday).end).toBe("2026-11-01");
  expect(biweeklyPayday(payday, start, payday)).toEqual(period);
  expect(biweeklyPayday("2026-12-04", start, payday)).toEqual({
    start: "2026-11-16",
    end: "2026-11-29",
    payday: "2026-12-04",
  });
  expect(biweeklyPayday("2026-12-05", start, payday)).toBeNull();
});

it("splits the exact fixed amount over eligible work and paid days, including spare cents", () => {
  const start = "2026-11-02";
  const calendar = {
    "2026": {
      source: "fixture",
      updated: start,
      days: { "2026-11-03": false, "2026-11-04": false, "2026-11-07": true },
      paidHolidays: { "2026-11-03": "带薪假" },
    },
  };
  const allocation = Array.from({ length: 14 }, (_, offset) =>
    biweeklyAllocation(
      addDays(start, offset),
      start,
      "1400.01",
      { ...rule, official: true },
      calendar,
      {},
    ),
  );
  expect(allocation.every(({ days }) => days === 10)).toBe(true);
  expect(allocation.map(({ cents }) => cents)).toEqual([
    14001, 14000, 0, 14000, 14000, 14000, 0, 14000, 14000, 14000, 14000, 14000,
    0, 0,
  ]);
  expect(allocation.reduce((sum, { cents }) => sum + cents, 0)).toBe(140001);
});
