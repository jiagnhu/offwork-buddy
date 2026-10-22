import { app, BrowserWindow, dialog, powerMonitor } from "electron";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadState, saveState } from "./store";
import { importBackup, validateBackup } from "./backup";
import {
  createWindows,
  applyPreferences,
  openPanel,
  showCompanion,
  companion,
} from "./windows";
import { registerIpc } from "./ipc";
import type { State, Snapshot } from "../shared/model";
import {
  preferencesSchema,
  ruleSchema,
  dateSchema,
  calendarSchema,
  parseState,
  plansSchema,
} from "../shared/schema";
import { dateKey, addDays } from "../core/date";
import {
  ruleForDate,
  scheduleRule,
  settleThrough,
  recalculateRange,
} from "../core/ledger";
import { calculateDay, emptyProgress } from "../core/earnings";
import { parseJsonStrict } from "../shared/json";
if (process.env.BUDDY_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.BUDDY_DATA_DIR));
app.setName("下班搭子");
let state: State;
let notice: string | null = null;
let lastDate = "";
let queue = Promise.resolve();
const directory = app.getPath("userData");
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
function snapshot(): Snapshot {
  const now = new Date(),
    today = dateKey(now),
    rule =
      state.configured && today >= state.startDate
        ? ruleForDate(state, today)
        : undefined;
  const progress = rule
    ? calculateDay(today, now, rule, state.calendar, state.overrides)
    : emptyProgress;
  const settledCents = Object.values(state.ledger).reduce(
    (sum, e) => sum + e.amountCents,
    0,
  );
  return {
    state,
    progress,
    settledCents,
    totalCents: settledCents + (state.ledger[today] ? 0 : progress.earnedCents),
    today,
    notice,
  };
}
function broadcast() {
  const s = snapshot();
  for (const win of BrowserWindow.getAllWindows())
    if (!win.isDestroyed()) win.webContents.send("buddy:snapshot", s);
  return s;
}
async function commit(next: State) {
  try {
    await saveState(directory, next);
  } catch (error) {
    console.error("Failed to save state", error);
    notice = "保存失败，请检查磁盘空间或数据目录权限后重试。";
    broadcast();
    throw new Error(notice);
  }
  state = next;
  if (notice?.startsWith("保存失败")) notice = null;
  applyPreferences(state.preferences);
  return broadcast();
}
async function readJson(file: string) {
  if ((await stat(file)).size > 20 * 1024 * 1024)
    throw new Error("文件超过 20 MB 限制");
  return parseJsonStrict(await readFile(file, "utf8"));
}
async function selectJson() {
  const r = await dialog.showOpenDialog({
    filters: [{ name: "JSON 数据", extensions: ["json"] }],
    properties: ["openFile"],
  });
  return r.canceled ? null : r.filePaths[0];
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (state) openPanel();
  });
  app
    .whenReady()
    .then(async () => {
      const loaded = await loadState(directory);
      state = loaded.state;
      notice = loaded.recoveryNotice ?? null;
      try {
        const bundled = calendarSchema.parse(
          JSON.parse(
            await readFile(
              path.join(__dirname, "../resources/calendar.json"),
              "utf8",
            ),
          ),
        );
        state.calendar = { ...bundled, ...state.calendar };
      } catch {
        notice = "内置日历不可用，可在日历页导入年度数据。";
      }
      state = settleThrough(state, new Date());
      await saveState(directory, state);
      lastDate = dateKey(new Date());
      createWindows(
        state.preferences,
        (p) => {
          void serial(() =>
            commit({
              ...state,
              preferences: { ...state.preferences, position: p },
            }),
          ).catch((e) => {
            notice = e.message;
            broadcast();
          });
        },
        () => {
          void serial(() =>
            commit({
              ...state,
              preferences: {
                ...state.preferences,
                alwaysOnTop: !state.preferences.alwaysOnTop,
              },
            }),
          ).catch(() => openPanel());
        },
      );
      registerIpc({
        getSnapshot: () => snapshot(),
        saveSettings: (input: unknown) =>
          serial(async () => {
            const data = z
              .object({ startDate: dateSchema, rule: z.unknown() })
              .parse(input);
            if (data.startDate > dateKey(new Date()))
              throw new Error("累计开始日期不能晚于今天");
            const rule = ruleSchema.parse({
              ...(data.rule as object),
              id: "input",
              effectiveFrom: data.startDate,
            });
            let next = structuredClone(state);
            if (next.configured && data.startDate !== next.startDate) {
              if (data.startDate > next.startDate)
                throw new Error("已累计后只能向前扩展开始日期");
              next.startDate = data.startDate;
              next.rules[0].effectiveFrom = data.startDate;
            } else next.startDate = data.startDate;
            next = scheduleRule(next, rule, new Date());
            return commit(settleThrough(parseState(next), new Date()));
          }),
        setPreferences: (input: unknown) =>
          serial(() =>
            commit({
              ...state,
              preferences: preferencesSchema.parse({
                ...state.preferences,
                ...preferencesSchema.partial().parse(input),
              }),
            }),
          ),
        setDayOverride: (date: unknown, value: unknown) =>
          serial(() => {
            const d = dateSchema.parse(date),
              v = z.boolean().nullable().parse(value),
              next = structuredClone(state);
            if (v === null) delete next.overrides[d];
            else next.overrides[d] = v;
            return commit(next);
          }),
        savePlans: (date: unknown, input: unknown) =>
          serial(() => {
            const d = dateSchema.parse(date),
              plans = plansSchema.parse(input);
            const next = structuredClone(state);
            if (plans.length) next.plans[d] = plans;
            else delete next.plans[d];
            return commit(next);
          }),
        recalculate: (from: unknown, to: unknown) =>
          serial(async () => {
            const f = dateSchema.parse(from),
              t = dateSchema.parse(to);
            const answer = await dialog.showMessageBox({
              type: "warning",
              buttons: ["取消", "重算这段记录"],
              defaultId: 0,
              cancelId: 0,
              message: `重算 ${f} 至 ${t} 的预计收入？`,
              detail: "将用各日工资版本与当前日历覆盖这段历史记录。",
            });
            if (answer.response !== 1) return snapshot();
            return commit(recalculateRange(state, f, t, new Date()));
          }),
        exportBackup: () =>
          serial(async () => {
            const r = await dialog.showSaveDialog({
              defaultPath: `下班搭子备份-${dateKey(new Date())}.json`,
              filters: [{ name: "JSON 备份", extensions: ["json"] }],
            });
            if (r.canceled || !r.filePath) return null;
            await writeFile(r.filePath, JSON.stringify(state, null, 2), "utf8");
            return r.filePath;
          }),
        importBackup: () =>
          serial(async () => {
            const file = await selectJson();
            if (!file) return false;
            const raw = await readJson(file);
            validateBackup(raw);
            const r = await dialog.showMessageBox({
              type: "warning",
              message: "用这个备份替换当前所有记录？",
              detail: "导入前会自动保留当前数据备份。",
              buttons: ["取消", "导入并替换"],
              defaultId: 0,
              cancelId: 0,
            });
            if (r.response !== 1) return false;
            state = await importBackup(directory, raw);
            await commit(settleThrough(state, new Date()));
            return true;
          }),
        importCalendar: () =>
          serial(async () => {
            const file = await selectJson();
            if (!file) return false;
            const c = calendarSchema.parse(await readJson(file));
            await commit({ ...state, calendar: { ...state.calendar, ...c } });
            return true;
          }),
        openPanel: () => openPanel(),
        hideCompanion: () => companion.hide(),
        showCompanion: () => showCompanion(),
      });
      const tick = () => {
        if (dateKey(new Date()) !== lastDate)
          void serial(async () => {
            await commit(settleThrough(state, new Date()));
            lastDate = dateKey(new Date());
          }).catch((e) => {
            notice = e.message;
            broadcast();
          });
        else broadcast();
      };
      const interval = setInterval(tick, 1000);
      powerMonitor.on("resume", tick);
      app.on("before-quit", () => clearInterval(interval));
    })
    .catch((error) => {
      dialog.showErrorBox("下班搭子无法启动", String(error));
      app.quit();
    });
}
