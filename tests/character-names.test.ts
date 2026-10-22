import { test, expect } from "vitest";
import { parseState, preferencesSchema } from "../src/shared/schema";
import { characterName } from "../src/shared/characters";
import { fixture } from "./fixtures";

test("all five characters resolve independent names with original-name fallbacks", () => {
  const p = {
    haruName: "小晴",
    characterNames: {
      mao: "小猫",
      hiyori: "日和酱",
      miara: "精灵",
      rice: "书书",
    },
  };
  expect(
    ["haru", "mao", "hiyori", "miara", "rice"].map((k) =>
      characterName(k as any, p as any),
    ),
  ).toEqual(["小晴", "小猫", "日和酱", "精灵", "书书"]);
  expect(characterName("haru")).toBe("Haru");
  expect(characterName("rice")).toBe("Rice");
});
test("old default becomes Haru once, while custom names survive loading and roundtrip", () => {
  const old = fixture();
  old.preferences.haruName = "丝袜妹";
  expect(parseState(old).preferences.haruName).toBe("Haru");
  old.preferences.haruName = "小星";
  const migrated = parseState(old);
  expect(migrated.preferences.haruName).toBe("小星");
  const renamed = {
    ...migrated,
    preferences: {
      ...migrated.preferences,
      haruName: "丝袜妹",
      characterNames: { rice: "书书" },
    },
  };
  expect(
    parseState(JSON.parse(JSON.stringify(renamed))).preferences.haruName,
  ).toBe("丝袜妹");
});
test("nickname map validates and retains only supported characters", () => {
  const p = fixture().preferences;
  expect(
    preferencesSchema.safeParse({ ...p, characterNames: { rice: "  " } })
      .success,
  ).toBe(false);
  expect(
    preferencesSchema.safeParse({
      ...p,
      characterNames: { mao: "a".repeat(21) },
    }).success,
  ).toBe(false);
  expect(
    preferencesSchema.safeParse({ ...p, characterNames: { unknown: "x" } })
      .success,
  ).toBe(false);
  expect(
    preferencesSchema.parse({ ...p, characterNames: { rice: " 小书 " } }),
  ).toHaveProperty("characterNames.rice", "小书");
});
