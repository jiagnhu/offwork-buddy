import { test, expect } from "vitest";
import { effectiveMovementMode } from "../src/shared/character-capabilities";
import { fixture } from "./fixtures";
import { actionForCompanionEvent } from "../src/renderer/characters/live2d/actions";
test("reduced animation preserves the event cue for a static pose", () => {
  const event = {
    id: "once",
    kind: "plan-complete" as const,
    text: "完成",
    createdAt: 0,
    durationMs: 4000,
  };
  expect(actionForCompanionEvent(event, true)).toEqual({
    kind: "cue",
    cue: "happy",
  });
});
test("Haru remains stationary without losing the saved roaming preference", () => {
  const prefs = fixture().preferences;
  prefs.movementMode = "bottom";
  prefs.character = "haru";
  expect(effectiveMovementMode(prefs)).toBe("stationary");
  expect(prefs.movementMode).toBe("bottom");
  prefs.character = "pet";
  expect(effectiveMovementMode(prefs)).toBe("bottom");
});
