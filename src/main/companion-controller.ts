import type { BrowserWindow } from "electron";
import {
  holdAt,
  stepBehavior,
  type BehaviorInput,
  type BehaviorState,
} from "../core/companion-behavior";
export function startCompanionController(deps: {
  window: BrowserWindow;
  getInput: () => BehaviorInput;
  publish: (state: BehaviorState) => void;
  move: (x: number, y: number) => void;
}) {
  const w = deps.window;
  let state = holdAt(w.getBounds(), deps.getInput().now),
    timer: ReturnType<typeof setTimeout> | undefined,
    stopped = false,
    dragging = false;
  function reset() {
    const input = deps.getInput();
    state = holdAt(w.getBounds(), input.now);
    deps.publish(state);
  }
  const willMove = () => {
    dragging = true;
    reset();
  };
  const moved = () => {
    if (dragging) {
      dragging = false;
      reset();
    }
  };
  w.on("will-move", willMove);
  w.on("moved", moved);
  function tick() {
    if (stopped || w.isDestroyed()) return;
    const input = deps.getInput(),
      actual = w.getBounds();
    if (
      Math.abs(actual.x - state.position.x) > 2 ||
      Math.abs(actual.y - state.position.y) > 2
    )
      reset();
    const previous = state;
    state = stepBehavior(state, {
      ...input,
      dragging: input.dragging || dragging,
    });
    if (state.position.x !== actual.x || state.position.y !== actual.y)
      deps.move(state.position.x, state.position.y);
    if (
      previous.phase !== state.phase ||
      previous.direction !== state.direction
    )
      deps.publish(state);
    timer = setTimeout(tick, state.phase === "walking" ? 1000 / 30 : 200);
  }
  deps.publish(state);
  timer = setTimeout(tick, 200);
  return {
    pause() {
      reset();
    },
    resume() {
      dragging = false;
      reset();
    },
    recall() {
      dragging = false;
      reset();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      w.removeListener("will-move", willMove);
      w.removeListener("moved", moved);
    },
  };
}
