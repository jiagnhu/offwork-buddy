import { it, expect } from "vitest";
import { clampBounds } from "../src/main/bounds";
it("rescues removed display window", () =>
  expect(
    clampBounds({ x: 2100, y: 200, width: 360, height: 480 }, [
      { x: 0, y: 0, width: 1920, height: 1040 },
    ]),
  ).toEqual({ x: 1560, y: 200, width: 360, height: 480 }));
it("shrinks to available work area", () =>
  expect(
    clampBounds({ x: -100, y: -100, width: 2000, height: 1500 }, [
      { x: 0, y: 0, width: 800, height: 600 },
    ]),
  ).toEqual({ x: 0, y: 0, width: 800, height: 600 }));
