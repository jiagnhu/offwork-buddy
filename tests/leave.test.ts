import { expect, test } from "vitest";
import { calculateDayDetail } from "../src/core/earnings";
import { setLeave } from "../src/core/ledger";
import { parseState } from "../src/shared/schema";
import { fixture, rule } from "./fixtures";
const day = "2026-01-05";
test("leave unions overlaps and excludes lunch without changing daily rate", () => {
  const detail = calculateDayDetail(
    day,
    new Date("2026-01-05T14:00:00"),
    rule,
    {},
    {},
    [
      { start: 660, end: 810 },
      { start: 780, end: 840 },
    ],
  );
  expect(detail.progress.budgetCents).toBe(60000);
  expect(detail.progress.earnedCents).toBe(20000);
  expect(detail.leaveMinutes).toBe(120);
});
test("future leave reduces budget, freezes elapsed pay, and full-day leave earns zero", () => {
  const leaves = [{ start: 540, end: 1080 }];
  for (const now of [
    "2026-01-04T10:00:00",
    "2026-01-05T15:00:00",
    "2026-01-06T10:00:00",
  ]) {
    const d = calculateDayDetail(day, new Date(now), rule, {}, {}, leaves);
    expect(d.progress.budgetCents).toBe(0);
    expect(d.progress.earnedCents).toBe(0);
  }
});
test("historical leave is reversible, persisted, and uses saved rule", () => {
  const now = new Date("2026-01-06T10:00:00");
  let state = setLeave(fixture(), day, [{ start: 540, end: 600 }], now);
  expect(state.ledger[day].amountCents).toBe(70000);
  state.rules[0].amount = "1600";
  state = setLeave(parseState(state), day, [{ start: 540, end: 660 }], now);
  expect(state.ledger[day].amountCents).toBe(60000);
  state = setLeave(state, day, [], now);
  expect(state.ledger[day].amountCents).toBe(80000);
});
test("invalid leave rejected and old backups migrate", () => {
  expect(() =>
    setLeave(fixture(), day, [{ start: 700, end: 600 }], new Date()),
  ).toThrow();
  expect(parseState(fixture()).leaves).toEqual({});
});
test("paid holidays and rest days are not docked", () => {
  const calendar = {
    "2026": {
      source: "https://example.com",
      updated: day,
      days: { [day]: false },
      paidHolidays: { [day]: "节假日" },
    },
  };
  const d = calculateDayDetail(
    day,
    new Date("2026-01-06T12:00:00"),
    { ...rule, official: true },
    calendar,
    {},
    [{ start: 0, end: 1440 }],
  );
  expect(d.progress.earnedCents).toBe(80000);
  expect(d.leaveMinutes).toBe(0);
});
test("monthly denominator stays fixed; settlement and edits agree to the cent", () => {
  const state = fixture();
  state.rules[0] = {
    ...rule,
    mode: "monthly",
    amount: "16000",
    schedule: "alternating",
  };
  const intervals = [{ start: 570, end: 665 }];
  const base = calculateDayDetail(
    day,
    new Date("2026-01-06T10:00:00"),
    state.rules[0],
    {},
    {},
  );
  const current = calculateDayDetail(
    day,
    new Date("2026-01-06T10:00:00"),
    state.rules[0],
    {},
    {},
    intervals,
  );
  expect(current.denominator).toBe(base.denominator);
  const before = setLeave(
    state,
    day,
    intervals,
    new Date("2026-01-04T10:00:00"),
  );
  const after = setLeave(
    before,
    day,
    intervals,
    new Date("2026-01-06T10:00:00"),
  );
  expect(after.ledger[day].amountCents).toBe(current.progress.earnedCents);
  expect(
    setLeave(after, day, [], new Date("2026-01-06T10:00:00")).ledger[day]
      .amountCents,
  ).toBe(base.progress.earnedCents);
});
test("hourly income freezes during leave and resumes afterwards", () => {
  const hourly = { ...rule, mode: "hourly" as const, amount: "100" };
  const periods = [{ start: 600, end: 660 }];
  const earned = (time: string) =>
    calculateDayDetail(
      day,
      new Date(`${day}T${time}:00`),
      hourly,
      {},
      {},
      periods,
    ).progress.earnedCents;
  expect(earned("10:00")).toBe(10000);
  expect(earned("10:30")).toBe(10000);
  expect(earned("11:00")).toBe(10000);
  expect(earned("11:30")).toBe(15000);
});
