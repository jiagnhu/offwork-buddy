import { live2dModels, type Live2dKind } from "../../../shared/characters";
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
  _event: CompanionEvent,
  reducedMotion = false,
  kind: Live2dKind = "haru",
): HaruAction {
  if (reducedMotion)
    return {
      kind: "expression",
      id: kind === "haru" ? "F02" : (live2dModels[kind].expressions[0] ?? ""),
    };
  return { kind: "tap", index: 0 };
}
