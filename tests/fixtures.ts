import type { RuleVersion, State } from "../src/shared/model";
export const rule: RuleVersion = {
  id: "r1",
  effectiveFrom: "2026-01-01",
  mode: "daily",
  amount: "800",
  start: 540,
  end: 1080,
  breakStart: 720,
  breakEnd: 780,
  schedule: "double",
  restDay: 0,
  bigWeekMonday: "2026-01-05",
  official: false,
};
export function fixture(): State {
  return {
    schemaVersion: 2,
    growth:{points:0,days:{}},reminderHistory:{},
    configured: true,
    startDate: "2026-01-05",
    rules: [{ ...rule }],
    calendar: {},
    overrides: {},
    plans: {},
    ledger: {},
    preferences: {
      movementMode:'bottom',cardHidden:false,reminders:{lunch:true,offwork:true,leadMinutes:5},accessory:'none',
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
