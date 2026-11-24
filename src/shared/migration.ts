import type { JobMeta, LegacyState, State, StateV2, StateV3 } from "./model";
export function defaultJob(): JobMeta {
  return {
    id: "primary",
    name: "主业",
    color: "#4686ed",
    currency: "CNY",
    receivedPaydays: {},
  };
}
export function migrateV3(input: StateV3): State {
  return {
    ...input,
    schemaVersion: 4,
    primaryJob: defaultJob(),
    otherJobs: [],
    personalPlans: {},
  };
}
export function migrateV2(input: StateV2): StateV3 {
  return { ...input, schemaVersion: 3 };
}
export function migrateV1(input: LegacyState): StateV2 {
  return {
    ...input,
    plans: Object.fromEntries(
      Object.entries(input.plans).map(([d, items]) => [
        d,
        items.map((p) => (p.completed ? { ...p, rewardClaimed: true } : p)),
      ]),
    ),
    schemaVersion: 2,
    growth: { points: 0, days: {} },
    reminderHistory: {},
    preferences: {
      ...input.preferences,
      movementMode: "bottom",
      cardHidden: false,
      reminders: { lunch: true, offwork: true, leadMinutes: 5 },
      accessory: "none",
    },
  };
}
