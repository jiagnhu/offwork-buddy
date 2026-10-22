import { it, expect, vi } from "vitest";
import { startReminderController } from "../src/main/reminder-controller";
import { fixture } from "./fixtures";
it("failed reminder persistence deduplicates in memory and does not mutate state", async () => {
  const state = fixture();
  let now = new Date("2026-10-22T11:59:59+08:00"),
    count = 0,
    errors = 0;
  const controller = startReminderController({
    getState: () => state,
    now: () => now,
    isVisible: () => true,
    exclusive: (fn) => fn(),
    commit: async () => {
      throw Error("disk full");
    },
    emit: () => count++,
    onError: () => errors++,
  });
  try {
    now = new Date("2026-10-22T12:00:00+08:00");
    await controller.resume();
    expect(count).toBe(1);
    expect(errors).toBe(1);
    expect(state.reminderHistory).toEqual({});
    now = new Date("2026-10-22T11:59:59+08:00");
    await controller.resume();
    now = new Date("2026-10-22T12:00:00+08:00");
    await controller.resume();
    expect(count).toBe(1);
  } finally {
    controller.stop();
  }
});
