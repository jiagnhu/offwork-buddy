import { it, expect } from "vitest";
import { calculateDay } from "../src/core/earnings";
import { rule } from "./fixtures";
import calendar from "../resources/calendar.json";
it("October holidays and overrides do not inflate the alternating-week daily budget", () => {
  const r = {
    ...rule,
    mode: "monthly" as const,
    amount: "16000",
    schedule: "alternating" as const,
    bigWeekMonday: "2026-10-05",
    official: true,
  };
  // October has 22 weekdays and two scheduled Saturdays for this anchor.
  for (const overrides of [{}, { "2026-10-21": false }] as Record<
    string,
    boolean
  >[]) {
    expect(
      calculateDay(
        "2026-10-22",
        new Date("2026-10-22T18:00:00+08:00"),
        r,
        calendar,
        overrides,
      ).budgetCents,
    ).toBe(66667);
  }
  expect(
    calculateDay(
      "2026-10-10",
      new Date("2026-10-10T18:00:00+08:00"),
      r,
      calendar,
      {},
    ).earnedCents,
  ).toBe(66667);
});
it.each([
  ["11:59:59", "lunch", 1],
  ["12:00:00", "resume", 3600],
  ["12:59:59", "resume", 1],
  ["13:00:00", "offwork", 18000],
  ["18:00:00", "offwork", 0],
])(
  "countdown changes target at lunch boundaries %s",
  (time, target, seconds) => {
    const p = calculateDay(
      "2026-01-05",
      new Date(`2026-01-05T${time}+08:00`),
      rule,
      {},
      {},
    );
    expect(p.countdownSeconds).toBe(seconds);
    expect(p).toHaveProperty("countdownTarget", target);
  },
);
it("no lunch keeps the countdown on end of day", () => {
  const p = calculateDay(
    "2026-01-05",
    new Date("2026-01-05T11:00:00+08:00"),
    { ...rule, breakStart: null, breakEnd: null },
    {},
    {},
  );
  expect(p.countdownSeconds).toBe(25200);
  expect(p).toHaveProperty("countdownTarget", "offwork");
});
it.each([
  ["08:00:00", 0, "before"],
  ["12:00:00", 30000, "break"],
  ["13:00:00", 30000, "working"],
  ["18:00:00", 80000, "finished"],
])("daily progress at %s excludes lunch", (time, cents, status) => {
  const p = calculateDay(
    "2026-01-05",
    new Date(`2026-01-05T${time}+08:00`),
    rule,
    {},
    {},
  );
  expect(p.earnedCents).toBe(cents);
  expect(p.status).toBe(status);
});
it("hourly full day is eight hours", () =>
  expect(
    calculateDay(
      "2026-01-05",
      new Date("2026-01-05T19:00:00+08:00"),
      { ...rule, mode: "hourly", amount: "100" },
      {},
      {},
    ).earnedCents,
  ).toBe(80000));
it("monthly amount divides by 22 scheduled weekdays", () =>
  expect(
    calculateDay(
      "2026-01-05",
      new Date("2026-01-05T19:00:00+08:00"),
      { ...rule, mode: "monthly", amount: "22000" },
      {},
      {},
    ).budgetCents,
  ).toBe(100000));
it("rest day is zero", () =>
  expect(
    calculateDay(
      "2026-01-04",
      new Date("2026-01-04T19:00:00+08:00"),
      rule,
      {},
      {},
    ).earnedCents,
  ).toBe(0));
it("all days overridden to rest never divides by zero", () => {
  const overrides = Object.fromEntries(
    Array.from({ length: 31 }, (_, i) => [
      `2026-01-${String(i + 1).padStart(2, "0")}`,
      false,
    ]),
  );
  expect(
    calculateDay(
      "2026-01-05",
      new Date("2026-01-05T19:00:00+08:00"),
      { ...rule, mode: "monthly" },
      {},
      overrides,
    ).budgetCents,
  ).toBe(0);
});
