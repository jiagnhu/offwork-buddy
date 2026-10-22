import type { LegacyState, State } from "./model";
export function migrateV1(input: LegacyState): State {
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
