import { it, expect } from "vitest";
import {
  holdAt,
  stepBehavior,
  type BehaviorInput,
} from "../src/core/companion-behavior";
function input(now = 100000): BehaviorInput {
  return {
    now,
    random: 0.5,
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    windowSize: { width: 360, height: 310 },
    cardBounds: null,
    pointer: { x: -1000, y: -1000 },
    visible: true,
    suspended: false,
    reducedMotion: false,
    mode: "bottom",
    dragging: false,
    reactionUntil: 0,
  };
}
function ready() {
  return {
    ...holdAt({ x: 500, y: 718 }, 0),
    manualHoldUntil: 0,
    phaseUntil: 0,
    lastTick: 99950,
    pointerLeftAt: 97000,
  };
}
it("walks 120 DIP in six seconds then rests within the bottom bounds", () => {
  let s = stepBehavior(ready(), input());
  expect(s.phase).toBe("walking");
  expect(s.target).toEqual({ x: 620, y: 718 });
  expect(s.phaseUntil).toBe(106000);
  for (let t = 101000; t <= 106000; t += 1000) s = stepBehavior(s, input(t));
  expect(s.position).toEqual({ x: 620, y: 718 });
  expect(s.phase).not.toBe("walking");
  expect(s.phaseUntil - 106000).toBeGreaterThanOrEqual(20000);
  expect(s.phaseUntil - 106000).toBeLessThanOrEqual(45000);
});
it("pointer proximity stops movement and leaving waits two seconds", () => {
  const i = input();
  let s = stepBehavior(ready(), { ...i, pointer: { x: 441, y: 800 } });
  expect(s.position.x).toBe(500);
  s = stepBehavior(s, input(101000));
  s = stepBehavior(s, input(102000));
  s = stepBehavior(s, input(102999));
  expect(s.phase).not.toBe("walking");
  s = stepBehavior(s, input(103000));
  expect(s.phase).toBe("walking");
});
it("manual hold, reduced motion, hidden and sleep all suppress autonomous movement", () => {
  const s = holdAt({ x: 500, y: 200 }, 100000);
  expect(
    stepBehavior({ ...s, lastTick: 159950 }, input(159999)).position,
  ).toEqual(s.position);
  for (const flags of [
    { reducedMotion: true },
    { visible: false },
    { suspended: true },
    { mode: "stationary" as const },
  ])
    expect(stepBehavior(ready(), { ...input(), ...flags }).position).toEqual(
      ready().position,
    );
});
it("negative-coordinate displays and blocked bottom strips remain safe", () => {
  const i = {
    ...input(),
    workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
  };
  const s = { ...ready(), position: { x: -500, y: 718 } };
  expect(stepBehavior(s, i).target!.x).toBeLessThanOrEqual(-360);
  const blocked = {
    ...input(),
    cardBounds: { x: 0, y: 700, width: 1920, height: 340 },
  };
  expect(stepBehavior(ready(), blocked).phase).not.toBe("walking");
});

it("escapes an existing overlap without moving deeper into the card", () => {
  const i = {
    ...input(),
    cardBounds: { x: 500, y: 650, width: 360, height: 390 },
  };
  let s = stepBehavior(ready(), i);
  expect(s.phase).toBe("walking");
  for (let t = 101000; t <= 115000; t += 1000)
    s = stepBehavior(s, { ...i, now: t });
  expect(s.position.x + 360 <= 500 || s.position.x >= 860).toBe(true);
});
import { describe } from "vitest";
describe("continued roaming after descending next to a card", () => {
  it.each(["left", "right"] as const)(
    "turns away from a card on the %s after arriving at the bottom",
    (side) => {
      const i = {
        ...input(0),
        workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
        windowSize: { width: 432, height: 372 },
        cardBounds: { x: -1115, y: 250, width: 432, height: 528 },
      };
      const x = side === "right" ? -1559 : -671;
      let s = {
        ...holdAt({ x, y: 100 }, 0),
        direction: side,
        manualHoldUntil: 0,
        phaseUntil: 0,
      };
      let arrived = false;
      const afterArrival: number[] = [];
      for (let now = 100; now <= 180000; now += 100) {
        s = stepBehavior(s, { ...i, now, pointer: { x: 10000, y: 10000 } });
        if (s.position.y === 656) arrived = true;
        if (arrived) afterArrival.push(s.position.x);
      }
      expect(arrived).toBe(true);
      expect(
        Math.max(...afterArrival) - Math.min(...afterArrival),
      ).toBeGreaterThan(80);
    },
  );
});
