import type { Live2dKind } from "../../../shared/characters";
import type { CompanionEvent } from "../../../shared/model";
import type { HaruAction } from "./types";
export const haruActions = {
  idle: Array.from({ length: 2 }, (_, index): HaruAction => ({
    kind: "idle",
    index,
  })),
  tap: Array.from({ length: 4 }, (_, index): HaruAction => ({
    kind: "tap",
    index,
  })),
  expressions: Array.from({ length: 8 }, (_, i) => ({
    label: `表情 ${i + 1}`,
    action: { kind: "expression", id: `F0${i + 1}` } as HaruAction,
  })),
};
export function actionForCompanionEvent(
  event: CompanionEvent,
  _reducedMotion = false,
  _kind: Live2dKind = "haru",
): HaruAction {
  return {
    kind: "cue",
    cue:
      event.kind === "plan-complete"
        ? "happy"
        : event.kind === "reminder"
          ? "rest"
          : "attention",
  };
}
