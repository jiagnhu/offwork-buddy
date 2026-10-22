import { it, expect } from "vitest";
import { fixture, rule } from "./fixtures";
import { parseState, preferencesSchema } from "../src/shared/schema";
import { dueReminders } from "../src/core/reminders";
import { calculateDay } from "../src/core/earnings";
import { calendarIncome } from "../src/core/calendar-income";
import { settleThrough } from "../src/core/ledger";
import calendar from "../resources/calendar.json";
const at = (t: string) => new Date("2026-10-22T" + t + "+08:00");
it("old settings receive the editable name and disabled periodic reminder", () => {
  const s = parseState(fixture());
  expect(s.preferences.haruName).toBe("丝袜妹");
  expect(s.preferences.reminders.restMinutes).toBe(0);
  expect(
    preferencesSchema.safeParse({ ...s.preferences, haruName: "   " }).success,
  ).toBe(false);
  expect(
    preferencesSchema.safeParse({
      ...s.preferences,
      reminders: { ...s.preferences.reminders, restMinutes: 1 },
    }).success,
  ).toBe(false);
});
it("periodic rests follow each work segment and never fire in breaks or after work", () => {
  const s = fixture();
  s.preferences.reminders = {
    lunch: false,
    offwork: false,
    leadMinutes: 0,
    restMinutes: 60,
  };
  const due = (t: string) =>
    dueReminders(s, new Date(at(t).getTime() - 1000), at(t));
  expect(due("10:00:00").map((x) => x.kind)).toEqual(["rest"]);
  expect(due("12:00:00")).toEqual([]);
  expect(due("13:00:00")).toEqual([]);
  expect(due("14:00:00")).toHaveLength(1);
  expect(due("18:00:00")).toEqual([]);
  const item = due("10:00:00")[0];
  s.reminderHistory[item.key] = item.at;
  expect(due("10:00:00")).toEqual([]);
  expect(dueReminders(s, at("10:01:00"), at("11:20:00"))).toEqual([]);
  s.overrides["2026-10-22"] = false;
  expect(due("14:00:00")).toEqual([]);
});
it("statutory paid holiday uses unchanged normal-schedule day rate; adjusted rest is unpaid", () => {
  const r = {
    ...rule,
    official: true,
    mode: "monthly" as const,
    amount: "16000",
    schedule: "alternating" as const,
  };
  const n = new Date("2026-10-22T12:00:00+08:00");
  const holiday = calculateDay("2026-10-01", n, r, calendar, {}),
    work = calculateDay("2026-10-19", n, r, calendar, {});
  expect(holiday.status).toBe("rest");
  expect(holiday.earnedCents).toBe(work.budgetCents);
  expect(holiday.earnedCents).toBeGreaterThan(0);
  expect(calculateDay("2026-10-04", n, r, calendar, {}).earnedCents).toBe(0);
  expect(
    calculateDay("2026-10-01", n, r, calendar, { "2026-10-01": false })
      .earnedCents,
  ).toBe(0);
});
it("calendar respects start date, historic records, today and future budget", () => {
  const s = fixture();
  s.startDate = "2026-10-19";
  s.calendar = calendar;
  s.rules[0].official = true;
  const n = at("10:00:00");
  expect(calendarIncome(s, "2026-10-01", n).kind).toBe("before-start");
  const settled = settleThrough(s, n);
  settled.ledger["2026-10-19"].amountCents = 12345;
  expect(calendarIncome(settled, "2026-10-19", n)).toMatchObject({
    kind: "settled",
    amountCents: 12345,
  });
  expect(calendarIncome(settled, "2026-10-22", n)).toMatchObject({
    kind: "today",
    amountCents: 10000,
  });
  expect(calendarIncome(settled, "2026-10-23", n)).toMatchObject({
    kind: "estimated",
    amountCents: 80000,
  });
  expect(settleThrough(settled, n).ledger["2026-10-19"].amountCents).toBe(
    12345,
  );
});

it("enriches the old bundled calendar without overriding a custom calendar", async () => {
  const { mergeBundledCalendar } = await import("../src/core/calendar");
  const old = structuredClone(calendar) as any;
  delete old["2026"].paidHolidays;
  expect(
    Object.keys(mergeBundledCalendar(calendar, old)["2026"].paidHolidays ?? {}),
  ).toHaveLength(13);
  old["2026"].source = "https://example.com/custom";
  expect(
    mergeBundledCalendar(calendar, old)["2026"].paidHolidays,
  ).toBeUndefined();
});
it("paid holidays today and in the future have explicit amounts and schema rejects contradictory dates", async () => {
  const { calendarSchema } = await import("../src/shared/schema");
  const r = { ...rule, official: true };
  const today = calculateDay(
    "2026-10-01",
    new Date("2026-10-01T01:00:00+08:00"),
    r,
    calendar,
    {},
  );
  expect(today).toMatchObject({
    status: "rest",
    earnedCents: 80000,
    countdownSeconds: 0,
  });
  const future = calculateDay(
    "2026-10-01",
    new Date("2026-09-30T01:00:00+08:00"),
    r,
    calendar,
    {},
  );
  expect(future).toMatchObject({ earnedCents: 0, budgetCents: 80000 });
  const bad = structuredClone(calendar);
  bad["2026"].days["2026-10-01"] = true;
  expect(calendarSchema.safeParse(bad).success).toBe(false);
});

it("enrichment preserves partial older calendars and never marks a saved workday paid", async () => {
  const { mergeBundledCalendar } = await import("../src/core/calendar");
  const { calendarSchema } = await import("../src/shared/schema");
  const old = {
    "2026": {
      source: calendar["2026"].source,
      updated: "2026-10-21",
      days: { "2026-10-01": false, "2026-10-02": true },
    },
  };
  const merged = mergeBundledCalendar(calendar, old);
  expect(calendarSchema.safeParse(merged).success).toBe(true);
  expect(merged["2026"].paidHolidays).toEqual({ "2026-10-01": "国庆节" });
});

it("a delayed rest reminder cannot cross lunch or the end of a shift", () => {
  const s = fixture();
  s.preferences.reminders = {
    lunch: false,
    offwork: false,
    leadMinutes: 0,
    restMinutes: 179,
  };
  expect(dueReminders(s, at("11:58:59"), at("12:00:00"))).toEqual([]);
  s.preferences.reminders.restMinutes = 239;
  s.rules[0].end = 1020;
  expect(dueReminders(s, at("16:58:59"), at("17:00:00"))).toEqual([]);
});
