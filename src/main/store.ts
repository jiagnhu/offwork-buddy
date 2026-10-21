import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import type { State } from "../shared/model";
import { parseState } from "../shared/schema";
import { initialState } from "../shared/defaults";
export interface LoadResult {
  state: State;
  recoveryNotice?: string;
}
export async function loadState(directory: string): Promise<LoadResult> {
  await mkdir(directory, { recursive: true });
  const primary = path.join(directory, "state.json");
  try {
    return { state: parseState(JSON.parse(await readFile(primary, "utf8"))) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { state: initialState() };
    try {
      const state = parseState(
        JSON.parse(
          await readFile(path.join(directory, "state.backup.json"), "utf8"),
        ),
      );
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
        recoveryNotice: "主数据损坏，已从最近备份恢复。损坏文件已保留。",
      };
    } catch {
      throw new Error(
        "无法读取本地数据。原文件已保留，请从备份恢复或检查数据目录：" +
          directory,
      );
    }
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
    parseState(JSON.parse(old));
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
