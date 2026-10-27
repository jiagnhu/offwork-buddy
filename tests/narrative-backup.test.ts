import { expect, test } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fixture } from "./fixtures";
import { emptyChat } from "../src/shared/chat";
import { ChatController } from "../src/main/chat-controller";
import {
  exportFullBackup,
  importFullBackup,
  recoverFullBackup,
} from "../src/main/backup";
test("full backup validates everything before replacement and legacy import preserves chat", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-full-"));
  try {
    const chat = emptyChat();
    chat.narrative.autoMemory = false;
    await writeFile(path.join(dir, "chat.json"), JSON.stringify(chat));
    const bundle = exportFullBackup(fixture(), chat);
    await expect(
      importFullBackup(dir, { ...bundle, chat: { version: 99 } }),
    ).rejects.toThrow();
    expect(
      JSON.parse(await readFile(path.join(dir, "chat.json"), "utf8")).narrative
        .autoMemory,
    ).toBe(false);
    const restored = await importFullBackup(dir, bundle);
    expect(restored.chat?.narrative.autoMemory).toBe(false);
    await importFullBackup(dir, fixture());
    expect(
      JSON.parse(await readFile(path.join(dir, "chat.json"), "utf8")).narrative
        .autoMemory,
    ).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("interrupted whole-backup transaction restores both original files before loading", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-recover-"));
  try {
    await writeFile(
      path.join(dir, "import-transaction.json"),
      JSON.stringify({ state: "old-state", chat: "old-chat" }),
    );
    await writeFile(path.join(dir, "state.json"), "partial-new");
    await recoverFullBackup(dir);
    expect(await readFile(path.join(dir, "state.json"), "utf8")).toBe(
      "old-state",
    );
    expect(await readFile(path.join(dir, "chat.json"), "utf8")).toBe(
      "old-chat",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("import advances the durable revision so pre-import UI operations cannot match the restored state", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-import-revision-"));
  try {
    const old = emptyChat();
    old.narrative.revision = 42;
    await writeFile(path.join(dir, "chat.json"), JSON.stringify(old));
    const restored = await importFullBackup(
      dir,
      exportFullBackup(fixture(), old),
    );
    const chat = new ChatController(
      restored.chat!,
      async () => {},
      () => {},
    );
    await expect(
      chat.narrativeAction("haru", {
        type: "clearMemory",
        revision: 42,
        opId: "old-ui",
      }),
    ).rejects.toThrow("内容已经变化");
    expect(
      JSON.parse(await readFile(path.join(dir, "chat.json"), "utf8")).narrative
        .revision,
    ).toBeGreaterThan(42);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
