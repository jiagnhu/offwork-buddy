import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const read = async (path) =>
  (await readFile(new URL(path, root), "utf8")).replace(/\r\n/g, "\n");
const inventory = JSON.parse(await read("src/shared/character-inventory.json"));
const directory = "docs/characters-v2/";
const files = await readdir(new URL(directory, root));
const interaction = await read(directory + "08-interaction-and-continuity.md");
const world = await read(directory + "00-world.md");
function section(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0) throw Error("Missing card heading: " + heading);
  const body = text.slice(start + heading.length);
  return body.split(/\n## /)[0].trim();
}
const intro = section(interaction, "## 二、七个角色的首屏介绍");
const labels = {
  haru: "Haru",
  mao: "Mao",
  hiyori: "日和",
  miara: "Miara",
  rice: "Rice",
  tororo: "Tororo",
  hijiki: "Hijiki",
};
const profiles = {},
  characters = {};
let source = world + interaction;
for (const kind of Object.keys(inventory)) {
  const filename = files.find((f) => f.endsWith(`-${kind}.md`));
  if (!filename) throw Error("Missing biography: " + kind);
  const biography = (await read(directory + filename))
    .replace(/\r\n/g, "\n")
    .trim();
  const row = intro
    .split(/\r?\n/)
    .find((line) => line.startsWith(`| ${labels[kind]} |`));
  if (!row || !biography.includes(`稳定 ID：${kind}`))
    throw Error("Invalid character: " + kind);
  const [, , traits, description] = row.split("|").map((v) => v.trim());
  profiles[kind] = {
    title: biography.split("\n")[0].replace(/^# /, ""),
    traits: traits.split("、"),
    description,
  };
  characters[kind] = {
    biography,
    knowledge: section(biography, "## 初始知识边界"),
    core:
      section(biography, "## 身份档案") +
      "\n" +
      section(biography, "## 性格结构"),
  };
  source += biography;
}
const version = "2.0.0";
const sourceHash = createHash("sha256")
  .update(source.replace(/\r\n/g, "\n"))
  .digest("hex");
const sharedWorld =
  section(world, "## 一、故事的核心") +
  "\n" +
  world.split("### 时间技术的五条硬规则")[1].split("### 署猫")[0].trim() +
  "\n故事起点固定为钟历312年晚秋，零号站重开一周年。现实用户日期不等于虚构城历。";
const outputs = {
  "src/shared/character-profiles.generated.json": {
    version,
    sourceHash,
    profiles,
  },
  "src/shared/character-lore.generated.json": {
    version,
    sourceHash,
    world: sharedWorld,
    characters,
  },
};
for (const [file, value] of Object.entries(outputs)) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if ((await read(file)).replace(/\r\n/g, "\n") !== text)
      throw Error("Stale generated cards: " + file);
  } else await writeFile(new URL(file, root), text, "utf8");
}
