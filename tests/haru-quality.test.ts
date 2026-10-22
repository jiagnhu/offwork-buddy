import { test, expect } from "vitest";
import { rasterSize } from "../src/renderer/characters/live2d/quality";
test("supersampling follows physical pixels and respects GPU limits without changing aspect", () => {
  expect(rasterSize(320, 440, 1, 4096)).toEqual({ width: 640, height: 880 });
  expect(rasterSize(400, 550, 1.5, 4096)).toEqual({
    width: 1200,
    height: 1650,
  });
  const limited = rasterSize(400, 550, 3, 1024);
  expect(limited.height).toBe(1024);
  expect(limited.width / limited.height).toBeCloseTo(400 / 550, 2);
  expect(rasterSize(0, 0, 1, 4096)).toEqual({ width: 1, height: 1 });
});
