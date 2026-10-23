import { expect, test, vi } from "vitest";
import { fixture } from "./fixtures";
import { monthDates, dateKey, secondsIntoDay } from "../src/core/date";
import { calendarIncome } from "../src/core/calendar-income";
import { countScheduledDays } from "../src/core/calendar";
test("calendar refresh reuses date formatters rather than constructing one per cell", () => {
  const state = fixture();
  state.rules[0].mode = "monthly";
  const now = new Date("2026-01-05T10:30:00+08:00");
  // Warm the timezone once; further ticks and calendar cells need no new formatter.
  dateKey(now);
  secondsIntoDay(now);
  const spy = vi.spyOn(Intl, "DateTimeFormat");
  try {
    for (let tick = 0; tick < 3; tick++)
      for (const date of monthDates("2026-01"))
        calendarIncome(state, date, now);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
test("schedule cache distinguishes changes even when a rule id stays the same", () => {
  const r = fixture().rules[0];
  expect(countScheduledDays("2026-01", r)).toBe(22);
  expect(countScheduledDays("2026-01", { ...r, schedule: "single" })).toBe(27);
  expect(countScheduledDays("2026-01", { ...r, schedule: "alternating" })).toBe(
    24,
  );
  expect(
    countScheduledDays("2026-01", {
      ...r,
      schedule: "alternating",
      bigWeekMonday: "2026-01-12",
    }),
  ).toBe(25);
  expect(countScheduledDays("2026-02", r)).toBe(20);
});
test("date helpers retain timezone and midnight boundaries", () => {
  const now = new Date("2026-01-01T16:00:01Z");
  expect(dateKey(now)).toBe("2026-01-02");
  expect(dateKey(now, "UTC")).toBe("2026-01-01");
  expect(secondsIntoDay(now)).toBe(1);
});
