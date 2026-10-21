import { it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadState, saveState } from "../src/main/store";
import { importBackup, validateBackup } from "../src/main/backup";
import { fixture } from "./fixtures";
const dirs: string[] = [];
async function dir() {
  const d = await mkdtemp(path.join(tmpdir(), "buddy-test-"));
  dirs.push(d);
  return d;
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
it("round trips and recovers previous valid state from corrupt primary", async () => {
  const d = await dir();
  await saveState(d, fixture());
  const newer = fixture();
  newer.preferences.theme = "dark";
  await saveState(d, newer);
  expect((await loadState(d)).state.preferences.theme).toBe("dark");
  await writeFile(path.join(d, "state.json"), "broken");
  const loaded = await loadState(d);
  expect(loaded.state).toEqual(fixture());
  expect(loaded.recoveryNotice).toBeTruthy();
  expect((await readdir(d)).some((f) => f.startsWith("corrupt-"))).toBe(true);
});
it("invalid import leaves primary untouched", async () => {
  const d = await dir();
  await saveState(d, fixture());
  const before = await readFile(path.join(d, "state.json"), "utf8");
  await expect(importBackup(d, { schemaVersion: 99 })).rejects.toThrow();
  expect(await readFile(path.join(d, "state.json"), "utf8")).toBe(before);
});
it("write failure leaves old primary readable", async () => {
  const d = await dir();
  await saveState(d, fixture());
  await mkdir(path.join(d, "state.tmp"));
  await expect(saveState(d, fixture())).rejects.toThrow();
  expect((await loadState(d)).state).toEqual(fixture());
});
it("refuses corrupt file when no backup exists", async () => {
  const d = await dir();
  await writeFile(path.join(d, "state.json"), "broken");
  await expect(loadState(d)).rejects.toThrow();
});
