import type { State, RuleInput } from "./model";
import { dateKey, addDays, weekday } from "../core/date";
export function defaultRule(now = new Date()): RuleInput {
  const today = dateKey(now);
  return {
    mode: "monthly",
    amount: "0",
    start: 540,
    end: 1080,
    breakStart: 720,
    breakEnd: 780,
    schedule: "double",
    restDay: 0,
    bigWeekMonday: addDays(today, -((weekday(today) + 6) % 7)),
    official: true,
  };
}
export function initialState(now = new Date()): State {
  return {
    schemaVersion: 1,
    configured: false,
    startDate: dateKey(now),
    rules: [],
    calendar: {},
    overrides: {},
    plans: {},
    ledger: {},
    preferences: {
      theme: "light",
      character: "pet",
      reducedMotion: false,
      scale: 1,
      alwaysOnTop: true,
      collapsed: false,
      autoStart: false,
    },
  };
}
