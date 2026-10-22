import { it, expect } from "vitest";
import { fixture } from "./fixtures";
import { dueReminders } from "../src/core/reminders";
const at = (time: string) => new Date(`2026-10-22T${time}+08:00`);
it("silent reminder candidates occur once at configured boundaries", () => {
  const s = fixture();
  s.rules[0].end = 1110;
  for (const [time, kind] of [
    ["11:55:00", "lunch-before"],
    ["12:00:00", "lunch-now"],
    ["18:25:00", "offwork-before"],
    ["18:30:00", "offwork-now"],
  ]) {
    const n = at(time),
      due = dueReminders(s, new Date(n.getTime() - 1000), n);
    expect(due.map((d) => d.kind)).toEqual([kind]);
    s.reminderHistory[due[0].key] = due[0].at;
    expect(dueReminders(s, new Date(n.getTime() - 1000), n)).toEqual([]);
  }
});
it("launch, late wake, clock rollback, rest days, and missing lunch produce no stale events", () => {
  const s = fixture();
  expect(dueReminders(s, at("12:00:00"), at("12:00:00"))).toEqual([]);
  expect(dueReminders(s, at("11:59:59"), at("12:01:01"))).toEqual([]);
  expect(dueReminders(s, at("11:59:59"), at("12:01:00"))).toHaveLength(1);
  expect(dueReminders(s, at("12:01:00"), at("12:00:00"))).toEqual([]);
  s.preferences.reminders.leadMinutes = 0;
  expect(dueReminders(s, at("11:54:59"), at("11:55:00"))).toEqual([]);
  s.rules[0].breakStart = null;
  s.rules[0].breakEnd = null;
  expect(dueReminders(s, at("11:59:59"), at("12:00:00"))).toEqual([]);
  s.overrides["2026-10-22"] = false;
  expect(dueReminders(s, at("17:59:59"), at("18:00:00"))).toEqual([]);
});
