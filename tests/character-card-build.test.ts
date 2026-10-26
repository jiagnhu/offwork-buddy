import { test, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("Windows CRLF checkout produces the same checked-in cards", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "buddy-cards-"));
  try {
    const files = [
      "scripts/build-character-cards.mjs",
      "src/shared/character-inventory.json",
      "src/shared/character-profiles.generated.json",
      "src/shared/character-lore.generated.json",
      ...(await readdir("docs/characters-v2"))
        .filter((f) => f.endsWith(".md"))
        .map((f) => "docs/characters-v2/" + f),
    ];
    for (const file of files) {
      const dest = path.join(temp, file);
      await mkdir(path.dirname(dest), { recursive: true });
      const content = await readFile(file, "utf8");
      await writeFile(dest, content.replace(/\r?\n/g, "\r\n"), "utf8");
    }
    expect(() =>
      execFileSync(
        process.execPath,
        [path.join(temp, "scripts/build-character-cards.mjs"), "--check"],
        { stdio: "pipe" },
      ),
    ).not.toThrow();
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
