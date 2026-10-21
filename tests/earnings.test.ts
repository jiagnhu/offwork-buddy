import { it, expect } from "vitest";
import { calculateDay } from "../src/core/earnings";
import { rule } from "./fixtures";
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
