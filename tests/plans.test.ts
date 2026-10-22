import { expect, it } from "vitest";
import { parseState } from "../src/shared/schema";
import { fixture } from "./fixtures";
it("old backups get an empty daily plan collection", () => {
  const { plans, ...old } = fixture();
  expect(parseState(old)).toHaveProperty("plans", {});
});
it("daily plans survive backup validation with completion state", () => {
  const plans = {
    "2026-10-22": [{ id: "one", text: "完成本周报告", completed: true }],
  };
  expect(parseState({ ...fixture(), plans })).toHaveProperty("plans", plans);
});
it.each([
  { "2026-02-30": [] },
  { "2026-10-22": [{ id: "one", text: "   ", completed: false }] },
  {
    "2026-10-22": [
      { id: "one", text: "a", completed: false },
      { id: "one", text: "b", completed: false },
    ],
  },
])("invalid plans cannot enter the saved data", (plans) => {
  expect(() => parseState({ ...fixture(), plans })).toThrow();
});
