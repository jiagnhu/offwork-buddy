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
export function actionForCompanionEvent(_event: CompanionEvent, reducedMotion=false): HaruAction {
  if(reducedMotion)return {kind:"expression",id:"F02"};
  return { kind: "tap", index: 0 };
}
