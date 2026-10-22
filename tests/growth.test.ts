import { it, expect } from "vitest";
import { fixture } from "./fixtures";
import { rewardInteraction, unlocks } from "../src/core/growth";
import { applyPlanAction } from "../src/core/plans";
const now = new Date("2026-10-22T10:00:00+08:00"),
  date = "2026-10-22";
it("one interaction and at most five unique plan rewards per day survive repeat actions", () => {
  let s = rewardInteraction(fixture(), now);
  s = rewardInteraction(s, now);
  expect(s.growth.points).toBe(1);
  for (let i = 0; i < 6; i++) {
    s = applyPlanAction(
      s,
      date,
      { type: "add", id: String(i), text: "任务" },
      now,
    );
    s = applyPlanAction(
      s,
      date,
      { type: "complete", id: String(i), completed: true },
      now,
    );
  }
  expect(s.growth.points).toBe(11);
  s = applyPlanAction(
    s,
    date,
    { type: "complete", id: "0", completed: false },
    now,
  );
  s = applyPlanAction(
    s,
    date,
    { type: "complete", id: "0", completed: true },
    now,
  );
  s = applyPlanAction(s, date, { type: "delete", id: "0" }, now);
  s = applyPlanAction(s, date, { type: "add", id: "0", text: "重建" }, now);
  s = applyPlanAction(
    s,
    date,
    { type: "complete", id: "0", completed: true },
    now,
  );
  expect(s.growth.points).toBe(11);
  expect(unlocks(9).star).toBe(false);
  expect(unlocks(10).star).toBe(true);
  expect(unlocks(30).pillow).toBe(true);
  expect(unlocks(60).celebration).toBe(true);
});
it("historical and future plans do not award points", () => {
  let s = fixture();
  for (const d of ["2026-10-21", "2026-10-23"]) {
    s = applyPlanAction(s, d, { type: "add", id: d, text: "任务" }, now);
    s = applyPlanAction(
      s,
      d,
      { type: "complete", id: d, completed: true },
      now,
    );
  }
  expect(s.growth.points).toBe(0);
});
it("independent plan IDs keep both updates; absent ID fails", () => {
  let s = fixture();
  for (const id of ["a", "b"])
    s = applyPlanAction(s, date, { type: "add", id, text: id }, now);
  for (const id of ["a", "b"])
    s = applyPlanAction(
      s,
      date,
      { type: "complete", id, completed: true },
      now,
    );
  expect(s.plans[date].every((p) => p.completed)).toBe(true);
  expect(() =>
    applyPlanAction(
      s,
      date,
      { type: "complete", id: "missing", completed: true },
      now,
    ),
  ).toThrow();
});
