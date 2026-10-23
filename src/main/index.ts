import { setLeave } from "../core/ledger";
import { leaveSchema } from "../shared/schema";
import { mergeBundledCalendar } from "../core/calendar";
import { startCompanionController } from "./companion-controller";
import { registerLive2dScheme, installLive2dProtocol } from "./live2d-assets";
import live2dLock from "../../resources/live2d/asset-lock.json";
import { effectiveMovementMode } from "../shared/character-capabilities";
registerLive2dScheme();
import { applyPlanAction } from "../core/plans";
import { startReminderController } from "./reminder-controller";
import { rewardInteraction, unlocks } from "../core/growth";
import {
  configureEvents,
  emitCompanionEvent,
  stopEvents,
  reactionUntil,
} from "./companion-events";
import { app, BrowserWindow, dialog, powerMonitor, screen } from "electron";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadState, saveState } from "./store";
import { importBackup, validateBackup } from "./backup";
import {
  dragCompanion,
  createWindows,
  applyPreferences,
  openPanel,
  showCompanion,
  hideCompanion,
  recallCompanion,
  isDesktopVisible,
  onDesktopVisibility,
  companion,
  panel,
  desktopCard,
  moveCharacter,
  onRecall,
  onCardClosed,
} from "./windows";
import { registerIpc } from "./ipc";
import type { State, Snapshot } from "../shared/model";
import {
  preferencesSchema,
  ruleSchema,
  dateSchema,
  calendarSchema,
  parseState,
  planActionSchema,
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
import { earningsDetail } from "../core/earnings-detail";
import type { NavigateTarget } from "../shared/bridge";
let pendingNavigation: NavigateTarget | null = null;
if (process.env.BUDDY_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.BUDDY_DATA_DIR));
app.setName("下班搭子");
let state: State;
let behavior: Snapshot["behavior"] = { phase: "idle", direction: "right" };
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
    ? calculateDay(
        today,
        now,
        rule,
        state.calendar,
        state.overrides,
        state.leaves?.[today],
      )
    : emptyProgress;
  const settledCents = Object.values(state.ledger).reduce(
    (sum, e) => sum + e.amountCents,
    0,
  );
  return {
    state,
    behavior,
    desktop: {
      visible: isDesktopVisible(),
      paused:
        effectiveMovementMode(state.preferences) === "stationary" ||
        state.preferences.reducedMotion,
    },
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
  const unlocked = unlocks(next.growth.points);
  if (
    next.preferences.accessory !== "none" &&
    !unlocked[next.preferences.accessory]
  )
    throw new Error("这个配饰尚未解锁");
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
      installLive2dProtocol(
        path.join(__dirname, "../resources/live2d"),
        live2dLock,
      );
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
        state.calendar = mergeBundledCalendar(bundled, state.calendar);
      } catch {
        notice = "内置日历不可用，可在日历页导入年度数据。";
      }
      state = settleThrough(state, new Date());
      await saveState(directory, state);
      lastDate = dateKey(new Date());
      createWindows(
        state.preferences,
        (p, kind) => {
          void serial(() =>
            commit({
              ...state,
              preferences: {
                ...state.preferences,
                [kind === "card" ? "cardPosition" : "position"]: p,
              },
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
      onCardClosed(() => {
        void serial(() =>
          commit({
            ...state,
            preferences: {
              ...state.preferences,
              cardHidden: true,
              collapsed: false,
            },
          }),
        ).catch((e) => {
          notice = e.message;
          broadcast();
        });
      });
      onDesktopVisibility(() => {
        if (!isDesktopVisible()) stopEvents();
        broadcast();
      });
      configureEvents(
        (e) => {
          for (const w of BrowserWindow.getAllWindows())
            w.webContents.send("buddy:companion-event", e);
        },
        () => companion.isVisible(),
      );
      app.on("before-quit", stopEvents);
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
          serial(() => {
            const patch = preferencesSchema.partial().parse(input);
            return commit({
              ...state,
              preferences: preferencesSchema.parse({
                ...state.preferences,
                ...patch,
                characterNames: {
                  ...state.preferences.characterNames,
                  ...patch.characterNames,
                },
              }),
            });
          }),
        setLeave: (date: unknown, input: unknown) =>
          serial(() =>
            commit(
              setLeave(
                state,
                dateSchema.parse(date),
                leaveSchema.parse(input),
                new Date(),
              ),
            ),
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
        updatePlan: (date: unknown, input: unknown) =>
          serial(async () => {
            const d = dateSchema.parse(date),
              action = planActionSchema.parse(input);
            const previous = state.plans[d]?.find(
              (p) => p.id === action.id,
            )?.completed;
            const next = applyPlanAction(state, d, action, new Date());
            const result = await commit(next);
            if (
              action.type === "complete" &&
              action.completed &&
              !previous &&
              d === dateKey(new Date())
            )
              emitCompanionEvent("plan-complete", "又完成了一件事，做得很好！");
            return result;
          }),
        interact: () =>
          serial(async () => {
            const next = rewardInteraction(state, new Date());
            const result =
              next.growth.points !== state.growth.points
                ? await commit(next)
                : snapshot();
            emitCompanionEvent("interaction", "我在这里陪着你，慢慢来就好。");
            return result;
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
        getEarningsDetail: (date: unknown) =>
          earningsDetail(state, dateSchema.parse(date), new Date()),
        takeNavigation: () => {
          const target = pendingNavigation;
          pendingNavigation = null;
          return target;
        },
        openPanel: (input: unknown) => {
          if (input !== undefined) {
            const target = z
              .union([
                z.object({ page: z.literal("calendar"), date: dateSchema }),
                z.object({ page: z.literal("earnings"), date: dateSchema }),
                z.object({ page: z.literal("growth") }),
              ])
              .parse(input);
            pendingNavigation = target;
            panel.webContents.send("buddy:navigate", target);
          }
          openPanel();
        },
        hideCompanion: () => hideCompanion(),
        dragCompanion: (input: unknown) =>
          dragCompanion(
            z
              .object({
                phase: z.enum(["start", "move", "end"]),
                x: z.number().finite().min(-100000).max(100000),
                y: z.number().finite().min(-100000).max(100000),
              })
              .parse(input),
          ),
        recallCompanion: () => recallCompanion(),
        setCardHidden: (hidden: unknown) =>
          serial(() =>
            commit({
              ...state,
              preferences: {
                ...state.preferences,
                cardHidden: z.boolean().parse(hidden),
                collapsed: false,
              },
            }),
          ),
        showCompanion: () => showCompanion(),
      });
      let suspended = false;
      let activeDisplay = screen.getDisplayMatching(companion.getBounds()).id;
      const mover = startCompanionController({
        window: companion,
        move: moveCharacter,
        publish: (b) => {
          behavior = { phase: b.phase, direction: b.direction };
          broadcast();
        },
        getInput: () => {
          const displays = screen.getAllDisplays();
          const display =
            displays.find((d) => d.id === activeDisplay) ??
            screen.getPrimaryDisplay();
          const bounds = companion.getBounds();
          return {
            now: Date.now(),
            random: Math.random(),
            workArea: display.workArea,
            windowSize: { width: bounds.width, height: bounds.height },
            cardBounds: desktopCard.isVisible()
              ? desktopCard.getBounds()
              : null,
            pointer: screen.getCursorScreenPoint(),
            visible: isDesktopVisible(),
            suspended,
            reducedMotion: state.preferences.reducedMotion,
            mode: effectiveMovementMode(state.preferences),
            dragging: false,
            reactionUntil: reactionUntil(),
          };
        },
      });
      companion.on("moved", () => {
        activeDisplay = screen.getDisplayMatching(companion.getBounds()).id;
      });
      onRecall(() => {
        activeDisplay = screen.getDisplayMatching(companion.getBounds()).id;
        mover.recall();
      });
      powerMonitor.on("suspend", () => {
        suspended = true;
        mover.pause();
      });
      powerMonitor.on("resume", () => {
        suspended = false;
        mover.resume();
      });
      screen.on("display-removed", () => mover.resume());
      screen.on("display-metrics-changed", () => mover.resume());
      app.on("before-quit", () => mover.stop());
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
      const reminders = startReminderController({
        getState: () => state,
        commit,
        isVisible: isDesktopVisible,
        emit: (text) => emitCompanionEvent("reminder", text),
        now: () => new Date(),
        exclusive: serial,
        onError: (e) => {
          notice = e instanceof Error ? e.message : "提醒记录保存失败";
          broadcast();
        },
      });
      powerMonitor.on("resume", () => void reminders.resume());
      app.on("before-quit", () => reminders.stop());
      powerMonitor.on("resume", tick);
      app.on("before-quit", () => clearInterval(interval));
      let exitFlushed = false;
      app.on("before-quit", (event) => {
        if (exitFlushed) return;
        event.preventDefault();
        stopEvents();
        void serial(async () => {
          try {
            const c = companion.getBounds(),
              card = desktopCard.getBounds();
            await saveState(directory, {
              ...state,
              preferences: {
                ...state.preferences,
                position: { x: c.x, y: c.y },
                cardPosition: { x: card.x, y: card.y },
              },
            });
          } catch (e) {
            console.error("Failed to save final desktop position", e);
          } finally {
            exitFlushed = true;
            app.quit();
          }
        });
      });
    })
    .catch((error) => {
      dialog.showErrorBox("下班搭子无法启动", String(error));
      app.quit();
    });
}
