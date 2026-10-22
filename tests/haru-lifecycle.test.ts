import { test, expect, vi } from "vitest";
import {
  mountResource,
  frameLoop,
} from "../src/renderer/characters/live2d/lifecycle";
test("late load after unmount is released and never activated", async () => {
  let finish!: (v: { dispose: () => void }) => void;
  let live = 0,
    disposed = 0;
  const stop = mountResource(
    () => new Promise<{ dispose(): void }>((r) => (finish = r)),
    () => live++,
    () => {},
  );
  stop();
  stop();
  finish({ dispose: () => disposed++ });
  await Promise.resolve();
  expect(live).toBe(0);
  expect(disposed).toBe(1);
});
test("active resource releases exactly once and load signal is cancelled", async () => {
  let signal!: AbortSignal,
    disposed = 0;
  const stop = mountResource(
    async (s) => {
      signal = s;
      return { dispose: () => disposed++ };
    },
    () => {},
    () => {},
  );
  await Promise.resolve();
  stop();
  stop();
  expect(signal.aborted).toBe(true);
  expect(disposed).toBe(1);
});
test("render loop caps frames and reduced motion has no pending callbacks", () => {
  const pending = new Map<number, FrameRequestCallback>();
  let next = 0,
    draws = 0;
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    pending.set(++next, f);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
  try {
    const loop = frameLoop(() => draws++);
    loop.setReduced(false);
    for (let ms = 0; ms <= 1000; ms += 16) {
      const entries = [...pending];
      pending.clear();
      entries.forEach(([, f]) => f(ms));
    }
    expect(draws).toBeGreaterThan(15);
    expect(draws).toBeLessThanOrEqual(31);
    loop.setReduced(true);
    expect(pending.size).toBe(0);
    loop.invalidate();
    expect(pending.size).toBe(0);
    loop.dispose();
    loop.dispose();
    expect(pending.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
