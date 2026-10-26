import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { characterOrder } from "../shared/characters";
import { emptyChat, messageSchema, type ChatState } from "../shared/chat";
import { emptyNarrative, narrativeSchema } from "../shared/narrative";
import { validateWorld } from "../core/story-engine";
export function parseChat(input: unknown): ChatState {
  const data = z
    .object({
      version: z.union([z.literal(1), z.literal(2)]),
      sessions: z.record(z.array(messageSchema).max(500)),
      narrative: narrativeSchema.optional(),
    })
    .parse(input);
  if (data.version === 2 && !data.narrative) throw Error("缺少故事和记忆数据");
  const state = emptyChat();
  state.narrative = data.narrative ?? emptyNarrative();
  for (const kind of characterOrder) {
    state.sessions[kind] = (data.sessions[kind] ?? []).map((m) =>
      m.status === "streaming" ? { ...m, status: "stopped" } : m,
    );
    state.narrative.memories[kind] ??= [];
    state.narrative.excluded[kind] ??= [];
    state.narrative.processed[kind] ??= [];
    if (data.version === 1)
      state.narrative.processed[kind] = state.sessions[kind].map((m) => m.id);
  }
  if (
    new Set(state.narrative.worlds.map((w) => w.id)).size !==
    state.narrative.worlds.length
  )
    throw Error("存档重复");
  if (
    state.narrative.selectedWorldId &&
    !state.narrative.worlds.some(
      (w) => w.id === state.narrative.selectedWorldId,
    )
  )
    throw Error("当前存档不存在");
  for (const world of state.narrative.worlds) {
    validateWorld(world);
    world.messages = world.messages.map((m) =>
      m.status === "streaming" ? { ...m, status: "stopped" } : m,
    );
  }
  return state;
}
export async function loadChat(directory: string): Promise<ChatState> {
  const state = emptyChat();
  let text: string;
  try {
    text = await readFile(path.join(directory, "chat.json"), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return state;
    throw new Error("聊天记录无法读取，请检查数据目录权限。");
  }
  try {
    return parseChat(JSON.parse(text));
  } catch {
    state.notice =
      "聊天记录损坏或版本不兼容，原文件已保留；继续聊天前会另存备份。";
  }
  return state;
}
export async function saveChat(directory: string, state: ChatState) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "chat.json");
  if (state.notice?.includes("原文件已保留")) {
    await copyFile(
      file,
      path.join(directory, `chat-preserved-${Date.now()}.json`),
    );
  }
  const sessions = Object.fromEntries(
    characterOrder.map((k) => [k, state.sessions[k].slice(-500)]),
  );
  await writeFile(
    file + ".tmp",
    JSON.stringify({
      version: 2,
      sessions,
      narrative: narrativeSchema.parse(state.narrative),
    }),
    "utf8",
  );
  await rename(file + ".tmp", file);
}
