import { expect, test, vi } from "vitest";
import { afterPaint } from "../src/renderer/hooks/afterPaint";
test("page work waits for paint and superseded navigation is cancelled", () => {
  vi.useFakeTimers();
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (n: number) => frames.delete(n));
  const step = () => {
    const current = [...frames.values()];
    frames.clear();
    current.forEach((fn) => fn(0));
  };
  try {
    const stale = vi.fn(),
      fresh = vi.fn();
    const cancel = afterPaint(stale);
    step();
    step();
    cancel();
    afterPaint(fresh);
    step();
    expect(fresh).not.toHaveBeenCalled();
    step();
    expect(fresh).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
