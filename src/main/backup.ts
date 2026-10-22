import { copyFile, writeFile } from "node:fs/promises";
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
