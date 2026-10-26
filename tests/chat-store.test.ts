import { test, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadChat, saveChat } from "../src/main/chat-store";
import { emptyChat, contextMessages } from "../src/shared/chat";
test("version one histories migrate without losing messages and narrative survives restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-migration-"));
  try {
    await writeFile(path.join(dir, "chat.json"), JSON.stringify({ version: 1, sessions: { haru: [{id:"u", role:"user", content:"旧记录", at:1, status:"complete"}] } }));
    const state = await loadChat(dir);
    expect(state.version).toBe(2);
    expect(state.sessions.haru[0].content).toBe("旧记录");
    state.narrative.autoMemory = false;
    await saveChat(dir, state);
    expect((await loadChat(dir)).narrative.autoMemory).toBe(false);
  } finally { await rm(dir, {recursive:true, force:true}); }
});
test("chat survives restart, interrupts unfinished responses and bounds context", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-chat-"));
  try {
    const state = emptyChat();
    state.sessions.haru = [
      { id: "u", role: "user", content: "你好", status: "complete", at: 1 },
      {
        id: "a",
        role: "assistant",
        content: "片段",
        status: "streaming",
        at: 2,
      },
    ];
    await saveChat(dir, state);
    const restored = await loadChat(dir);
    expect(restored.sessions.haru[1].status).toBe("stopped");
    expect(restored.sessions.mao).toEqual([]);
    expect(contextMessages(restored.sessions.haru)).toEqual([
      { role: "user", content: "你好" },
    ]);
    const many = Array.from({ length: 600 }, (_, i) => ({
      ...state.sessions.haru[0],
      id: String(i),
      content: "字".repeat(2000),
    }));
    state.sessions.haru = many;
    await saveChat(dir, state);
    expect((await loadChat(dir)).sessions.haru).toHaveLength(500);
    expect(
      contextMessages(many).reduce((s, m) => s + m.content.length, 0),
    ).toBeLessThanOrEqual(16000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("corrupt history is preserved and reported", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-chat-"));
  try {
    await writeFile(path.join(dir, "chat.json"), "broken");
    expect((await loadChat(dir)).notice).toBeTruthy();
    expect(await readFile(path.join(dir, "chat.json"), "utf8")).toBe("broken");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
