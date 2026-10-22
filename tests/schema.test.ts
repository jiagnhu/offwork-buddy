import { it, expect } from "vitest";
import { validateBackup } from "../src/main/backup";
import { fixture } from "./fixtures";
it("normalizes imported rule order before selecting the latest form values", () => {
  const state = fixture();
  state.rules = [
    {
      ...state.rules[0],
      id: "future",
      effectiveFrom: "2026-02-01",
      amount: "900",
    },
    state.rules[0],
  ];
  expect(validateBackup(state).rules.map((r) => r.amount)).toEqual([
    "800",
    "900",
  ]);
});
it.each(["-1", "Infinity", "NaN", "9007199254740992"])(
  "rejects invalid amount %s",
  (amount) => {
    const s = fixture();
    s.rules[0].amount = amount;
    expect(() => validateBackup(s)).toThrow();
  },
);
it("rejects impossible date and unknown version", () => {
  const s = fixture();
  s.startDate = "2026-02-30";
  expect(() => validateBackup(s)).toThrow();
  expect(() => validateBackup({ ...fixture(), schemaVersion: 99 })).toThrow();
});
it("rejects lunch outside shift and duplicate rule dates", () => {
  const s = fixture();
  s.rules[0].breakStart = 400;
  expect(() => validateBackup(s)).toThrow();
  const d = fixture();
  d.rules.push({ ...d.rules[0], id: "r2" });
  expect(() => validateBackup(d)).toThrow();
});
it("rejects mismatched ledger key", () => {
  const s = fixture();
  (s.ledger as any)["2026-01-05"] = { date: "2026-01-06" };
  expect(() => validateBackup(s)).toThrow();
});
it("rejects a locked accessory before importing a backup",()=>{const s=fixture();s.preferences.accessory="star";s.growth.points=9;expect(()=>validateBackup(s)).toThrow();s.growth.points=10;expect(validateBackup(s).preferences.accessory).toBe("star")});
