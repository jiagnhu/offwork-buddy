import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import type { State } from "../shared/model";
import { parseState } from "../shared/schema";
import { initialState } from "../shared/defaults";
import { parseJsonStrict } from "../shared/json";
export interface LoadResult {
  state: State;
  recoveryNotice?: string;
}
export async function loadState(directory: string): Promise<LoadResult> {
  await mkdir(directory, { recursive: true });
  const primary = path.join(directory, "state.json");
  // Upgrade backup errors must not be mistaken for corrupt-primary recovery.
  let original: string | undefined;
  try {
    original = await readFile(primary, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (original) {
    let raw: unknown;
    try {
      raw = parseJsonStrict(original);
      parseState(raw);
    } catch {
      raw = undefined; /* recovered below */
    }
    if ((raw as { schemaVersion?: number } | undefined)?.schemaVersion === 1) {
      await preserveLegacy(directory, original);
    }
  }
  try {
    return {
      state: parseState(parseJsonStrict(await readFile(primary, "utf8"))),
    };
  } catch (error) {
    const missingPrimary = (error as NodeJS.ErrnoException).code === "ENOENT";
    let backupText: string;
    try {
      backupText = await readFile(
        path.join(directory, "state.backup.json"),
        "utf8",
      );
    } catch (backupError) {
      if (
        missingPrimary &&
        (backupError as NodeJS.ErrnoException).code === "ENOENT"
      )
        return { state: initialState() };
      throw new Error(
        "无法读取本地数据。原文件已保留，请检查数据目录或恢复备份：" +
          directory,
      );
    }
    try {
      const state = parseState(parseJsonStrict(backupText));
      if (
        (parseJsonStrict(backupText) as { schemaVersion: number })
          .schemaVersion === 1
      )
        await preserveLegacy(directory, backupText);
      if (!missingPrimary)
        await copyFile(
          primary,
          path.join(directory, `corrupt-${Date.now()}.json`),
        );
      await writeFile(
        path.join(directory, "state.recovery.tmp"),
        JSON.stringify(state),
      );
      await rename(path.join(directory, "state.recovery.tmp"), primary);
      return {
        state,
        recoveryNotice: missingPrimary
          ? "主数据文件缺失，已从最近备份恢复。"
          : "主数据损坏，已从最近备份恢复。损坏文件已保留。",
      };
    } catch {
      throw new Error(
        "无法读取本地数据。原文件已保留，请从备份恢复或检查数据目录：" +
          directory,
      );
    }
  }
}
async function preserveLegacy(directory: string, text: string) {
  const file = path.join(directory, "state.pre-v2.json");
  try {
    await writeFile(file, text, { flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    await readFile(file, "utf8");
  }
}
export async function saveState(
  directory: string,
  state: State,
): Promise<void> {
  const valid = parseState(state);
  await mkdir(directory, { recursive: true });
  const primary = path.join(directory, "state.json"),
    temp = path.join(directory, "state.tmp");
  await writeFile(temp, JSON.stringify(valid, null, 2), "utf8");
  try {
    const old = await readFile(primary, "utf8");
    parseState(parseJsonStrict(old));
    await writeFile(path.join(directory, "state.backup.tmp"), old);
    await rename(
      path.join(directory, "state.backup.tmp"),
      path.join(directory, "state.backup.json"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await rename(temp, primary);
}
