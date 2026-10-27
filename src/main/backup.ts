import {
  copyFile,
  writeFile,
  readFile,
  rename,
  rm,
  mkdir,
} from "node:fs/promises";
import { z } from "zod";
import { parseChat, saveChat } from "./chat-store";
import type { ChatState } from "../shared/chat";
import path from "node:path";
import { parseState } from "../shared/schema";
import type { State } from "../shared/model";
import { saveState } from "./store";
export function validateBackup(input: unknown): State {
  return parseState(input);
}
export async function importBackup(
  directory: string,
  input: unknown,
): Promise<State> {
  const state = validateBackup(input);
  const version = (input as { schemaVersion?: number })?.schemaVersion;
  if (version === 1 || version === 2)
    await writeFile(
      path.join(directory, `imported-v${version}-${Date.now()}.json`),
      JSON.stringify(input, null, 2),
      { flag: "wx" },
    );
  try {
    await copyFile(
      path.join(directory, "state.json"),
      path.join(directory, `before-import-${Date.now()}.json`),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await saveState(directory, state);
  return state;
}

export function exportFullBackup(state: State, chat: ChatState) {
  return {
    format: "offwork-buddy" as const,
    version: 1 as const,
    state: parseState(state),
    chat: parseChat(chat),
  };
}
export function validateFullBackup(input: unknown): {
  state: State;
  chat?: ChatState;
} {
  if (input && typeof input === "object" && "format" in input) {
    const v = z
      .object({
        format: z.literal("offwork-buddy"),
        version: z.literal(1),
        state: z.unknown(),
        chat: z.unknown(),
      })
      .parse(input);
    return { state: parseState(v.state), chat: parseChat(v.chat) };
  }
  return { state: validateBackup(input) };
}
const journalSchema = z.object({
  state: z.string().nullable(),
  chat: z.string().nullable(),
});
async function readOptional(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function recoverFullBackup(directory: string) {
  const journal = path.join(directory, "import-transaction.json"),
    raw = await readOptional(journal);
  if (raw === null) return;
  const data = journalSchema.parse(JSON.parse(raw));
  for (const key of ["state", "chat"] as const) {
    const file = path.join(directory, key + ".json");
    if (data[key] === null) await rm(file, { force: true });
    else {
      await writeFile(file + ".restore", data[key], "utf8");
      await rename(file + ".restore", file);
    }
  }
  await rm(journal, { force: true });
}
export async function importFullBackup(directory: string, input: unknown) {
  const checked = validateFullBackup(input);
  if (!checked.chat) return { state: await importBackup(directory, input) };
  await mkdir(directory, { recursive: true });
  const old = {
    state: await readOptional(path.join(directory, "state.json")),
    chat: await readOptional(path.join(directory, "chat.json")),
  };
  let previousRevision = 0;
  try {
    if (old.chat)
      previousRevision = parseChat(JSON.parse(old.chat)).narrative.revision;
  } catch {
    /* A corrupt old file is preserved in the journal and snapshot. */
  }
  checked.chat.narrative.revision =
    Math.max(previousRevision, checked.chat.narrative.revision) + 1;
  const journal = path.join(directory, "import-transaction.json");
  await writeFile(journal + ".tmp", JSON.stringify(old), "utf8");
  await rename(journal + ".tmp", journal);
  await writeFile(
    path.join(directory, `before-full-import-${Date.now()}.json`),
    JSON.stringify(old),
    "utf8",
  );
  try {
    await saveState(directory, checked.state);
    await saveChat(directory, checked.chat);
    await rm(journal, { force: true });
  } catch (e) {
    await recoverFullBackup(directory);
    throw e;
  }
  return checked;
}
