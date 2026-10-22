import { test, expect } from "vitest";
import { chooseNativeAction } from "../src/renderer/characters/live2d/actions";

test("clicks can choose each native category", () => {
  expect(chooseNativeAction("haru", undefined, false, () => 0)?.kind).toBe(
    "idle",
  );
  expect(chooseNativeAction("haru", undefined, false, () => 0.4)?.kind).toBe(
    "tap",
  );
  expect(chooseNativeAction("haru", undefined, false, () => 0.9)?.kind).toBe(
    "expression",
  );
});
test("never repeats the last choice when alternatives exist", () => {
  let last: any;
  for (let i = 0; i < 30; i++) {
    const next = chooseNativeAction("haru", last, false, () => 0);
    expect(next).not.toEqual(last);
    last = next;
  }
});
test("characters without expressions use only their available motion groups", () => {
  for (const kind of ["hiyori", "miara", "rice"] as const)
    for (const r of [0, 0.3, 0.7, 0.999])
      expect(["idle", "tap"]).toContain(
        chooseNativeAction(kind, undefined, false, () => r)?.kind,
      );
});
test("reduced motion picks only static expressions and safely handles missing expressions", () => {
  expect(chooseNativeAction("haru", undefined, true)?.kind).toBe("expression");
  expect(chooseNativeAction("rice", undefined, true)).toBeNull();
});
