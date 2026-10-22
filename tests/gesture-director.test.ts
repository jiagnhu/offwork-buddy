import { expect, test } from "vitest";
import {
  MotionDirector,
  sampleGesture,
  boundedOffset,
} from "../src/renderer/characters/live2d/gestures";
import { actionForCompanionEvent } from "../src/renderer/characters/live2d/actions";

test("events select distinct semantic reactions", () => {
  const actions = ["interaction", "plan-complete", "reminder"].map((kind) =>
    actionForCompanionEvent({
      id: kind,
      kind,
      text: "",
      createdAt: 0,
      durationMs: 4000,
    } as any),
  );
  expect(actions).toEqual([
    { kind: "cue", cue: "attention" },
    { kind: "cue", cue: "happy" },
    { kind: "cue", cue: "rest" },
  ]);
});
test("idle rotation waits, repeats indefinitely and avoids the last gesture", () => {
  const d = new MotionDirector(() => 0);
  expect(d.advance(19).started).toBeUndefined();
  expect(d.advance(1).started).toBe("attention");
  d.advance(4);
  expect(d.advance(20).started).toBe("thinking");
  d.advance(4);
  expect(d.advance(20).started).toBe("rest");
});
test("rapid clicks do not restart a gesture or displace celebration", () => {
  const d = new MotionDirector(() => 0);
  d.request("attention");
  expect(d.advance(1).started).toBe("attention");
  d.request("happy");
  for (let i = 0; i < 50; i++) d.request("attention");
  expect(d.advance(1).started).toBeUndefined();
  expect(d.advance(3).started).toBe("happy");
});
test("reduced motion clears pending animation and remains static", () => {
  const d = new MotionDirector(() => 0);
  d.request("happy");
  d.advance(1);
  d.request("rest");
  d.setReduced(true);
  expect(d.advance(100).started).toBeUndefined();
  d.setReduced(false);
  expect(d.advance(1).started).toBeUndefined();
});
test("native clips cannot be restarted by repeated requests or interrupted by idle rotation", () => {
  const d = new MotionDirector(() => 0);
  d.advance(19);
  d.requestNative({ kind: "tap", index: 2 }, 9);
  expect(d.advance(0.1).native).toEqual({ kind: "tap", index: 2 });
  for (let i = 0; i < 8; i++) {
    d.requestNative({ kind: "tap", index: 2 }, 9);
    const f = d.advance(1);
    expect(f.native).toBeUndefined();
    expect(f.started).toBeUndefined();
  }
  d.request("rest");
  expect(d.advance(1).started).toBe("rest");
});
test("gestures return to neutral and use model-specific capabilities", () => {
  for (const kind of ["haru", "hiyori", "mao", "miara", "rice"] as const) {
    for (const cue of ["attention", "thinking", "happy", "rest"] as const) {
      expect(
        Object.values(sampleGesture(kind, cue, 0)).every((v) => v === 0),
      ).toBe(true);
      expect(
        Object.values(sampleGesture(kind, cue, 1)).every(
          (v) => Math.abs(v) < 1e-10,
        ),
      ).toBe(true);
      expect(
        Object.values(sampleGesture(kind, cue, 0.4)).some(
          (v) => Math.abs(v) > 0.01,
        ),
      ).toBe(true);
    }
  }
  expect(sampleGesture("rice", "happy", 0.4)).toHaveProperty("ParamBookPage");
  expect(sampleGesture("rice", "thinking", 0.4)).not.toHaveProperty(
    "ParamAngleY",
  );
  expect(boundedOffset(0.95, 0.2, 0, 1)).toBe(1);
  expect(boundedOffset(0.05, -0.2, 0, 1)).toBe(0);
});
