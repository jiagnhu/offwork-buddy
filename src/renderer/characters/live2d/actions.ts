import { live2dModels, type Live2dKind } from "../../../shared/characters";
import type { CompanionEvent } from "../../../shared/model";
import type { HaruAction, NativeAction } from "./types";

export function chooseNativeAction(
  kind: Live2dKind,
  last?: NativeAction,
  reduced = false,
  random = Math.random,
  group?: "idle" | "tap",
): NativeAction | null {
  const info = live2dModels[kind];
  const all: NativeAction[][] = [
    Array.from({ length: info.idle }, (_, index) => ({ kind: "idle", index })),
    Array.from({ length: info.tap }, (_, index) => ({ kind: "tap", index })),
    info.expressions.map((id) => ({ kind: "expression", id })),
  ];
  const available = all
    .map((items) =>
      items.filter((a) =>
        reduced ? a.kind === "expression" : !group || a.kind === group,
      ),
    )
    .filter((items) => items.length);
  const candidates = available
    .map((items) =>
      items.filter((a) => JSON.stringify(a) !== JSON.stringify(last)),
    )
    .filter((items) => items.length);
  const groups = candidates.length ? candidates : available;
  if (!groups.length) return null;
  const pool = groups[Math.floor(random() * groups.length)];
  return pool[Math.floor(random() * pool.length)];
}

export function actionForCompanionEvent(
  event: CompanionEvent,
  _reduced = false,
  _kind: Live2dKind = "haru",
): HaruAction {
  return {
    kind: "random",
    group:
      event.kind === "plan-complete"
        ? "tap"
        : event.kind === "reminder"
          ? "idle"
          : undefined,
  };
}
