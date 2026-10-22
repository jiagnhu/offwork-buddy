import type { LegacyState, State, StateV2 } from "./model";
export function migrateV2(input: StateV2): State {
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
