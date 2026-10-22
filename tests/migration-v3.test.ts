import { test, expect } from "vitest";
import { fixture } from "./fixtures";
import { parseState } from "../src/shared/schema";
import { loadState } from "../src/main/store";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
function v2() {
  const s = fixture();
  s.growth.points = 30;
  s.preferences.accessory = "star";
  s.preferences.movementMode = "bottom";
  s.plans = {
    "2026-10-22": [
      { id: "p", text: "保留", completed: true, rewardClaimed: true },
    ],
  };
  s.ledger = {
    "2026-10-21": {
      date: "2026-10-21",
      ruleId: s.rules[0].id,
      rule: s.rules[0],
      workday: true,
      amountCents: 84211,
      workdayCount: 23,
      calendarSnapshot: {
        workday: true,
        source: "schedule",
        calendarMissing: false,
      },
    },
  };
  return { ...s, schemaVersion: 2 };
}
test("v2 migration preserves money, plans, growth, accessories and roaming", () => {
  const old = v2(),
    result = parseState(old);
  expect(result).toEqual({
    ...old,
    schemaVersion: 3,
    preferences: {
      ...old.preferences,
      haruName: "丝袜妹",
      reminders: { ...old.preferences.reminders, restMinutes: 0 },
    },
  });
});
test("only v3 accepts Haru and rejects unknown versions", () => {
  const old = v2();
  expect(() =>
    parseState({
      ...old,
      preferences: { ...old.preferences, character: "haru" },
    }),
  ).toThrow();
  const next = {
    ...old,
    schemaVersion: 3,
    preferences: { ...old.preferences, character: "haru" },
  };
  expect(parseState(next)).toEqual({
    ...next,
    preferences: {
      ...next.preferences,
      haruName: "丝袜妹",
      reminders: { ...next.preferences.reminders, restMinutes: 0 },
    },
  });
  expect(() => parseState({ ...next, schemaVersion: 99 })).toThrow();
});
test("v2 original bytes are preserved and backup failure stops upgrade", async () => {
  const dir = await mkdtemp(join(tmpdir(), "buddy-v3-"));
  try {
    const raw = JSON.stringify(v2());
    await writeFile(join(dir, "state.json"), raw);
    await mkdir(join(dir, "state.pre-v3.json"));
    await expect(loadState(dir)).rejects.toThrow();
    expect(await readFile(join(dir, "state.json"), "utf8")).toBe(raw);
    await rm(join(dir, "state.pre-v3.json"), { recursive: true });
    expect((await loadState(dir)).state.schemaVersion).toBe(3);
    expect(await readFile(join(dir, "state.pre-v3.json"), "utf8")).toBe(raw);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("future primary never silently falls back to older backup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "buddy-future-"));
  try {
    const raw = JSON.stringify({ ...v2(), schemaVersion: 99 });
    await writeFile(join(dir, "state.json"), raw);
    await writeFile(join(dir, "state.backup.json"), JSON.stringify(v2()));
    await expect(loadState(dir)).rejects.toThrow();
    expect(await readFile(join(dir, "state.json"), "utf8")).toBe(raw);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
