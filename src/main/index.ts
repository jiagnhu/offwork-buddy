import { InteractionReply } from "./interaction-reply";
import { AISettings } from "./ai-settings";
import {
  openDesktopChat,
  closeDesktopChat,
  updateDesktopReply,
  getDesktopReply,
  resizeDesktopReply,
  shapeDesktopReply,
  keepDesktopReply,
  hoverDesktopReply,
  showCompanionReply,
} from "./desktop-chat-window";
import { safeStorage } from "electron";
import { ChatController, chatTransport } from "./chat-controller";
import { loadChat, saveChat } from "./chat-store";
import { characterName, normalizeCharacter } from "../shared/characters";
import { setLeave } from "../core/ledger";
import {
  archiveJob, inJobPeriod, primaryJob, saveJob, setPaydayReceived, setPrimaryJob,
  settleAllJobs, withJob, jobState, listJobs,
} from "../core/jobs";
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
import {
  exportFullBackup,
  importFullBackup,
  validateFullBackup,
  recoverFullBackup,
} from "./backup";
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
  recalculateRange,
} from "../core/ledger";
import { calculateDay, emptyProgress } from "../core/earnings";
import { parseJsonStrict } from "../shared/json";
import { combinedDayIncome, freezeLedgerQuotes, settledJobTotals } from "../core/work-income";
import { emptyFxBook } from "../core/fx";
import { refreshFxRates } from "./fx-rates";
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
let settledCache: { state: State; date: string; totals: ReturnType<typeof settledJobTotals> } | undefined;
let fxRequest: symbol | undefined;
let fxNextAttempt = 0;
let fxRange = "";
function resetExchangeRates() {
  fxRequest = undefined;
  fxNextAttempt = 0;
  fxRange = "";
}
function prepareJobHistory(input: State, now = new Date()) {
  return freezeLedgerQuotes(settleAllJobs(input, now), dateKey(now));
}
function updateExchangeRates() {
  const today = dateKey(new Date());
  const usdJobs = listJobs(state).filter(j => j.currency === "USD");
  if (fxRequest || !usdJobs.length) return;
  const from = usdJobs.reduce((start, j) => j.startDate < start ? j.startDate : start, today);
  const to = usdJobs.reduce((end, j) => {
    const last = j.endDate && j.endDate < today ? j.endDate : today;
    return last > end ? last : end;
  }, from);
  const range = from + "/" + to;
  if (range === fxRange && Date.now() < fxNextAttempt) return;
  const request = Symbol();
  fxRequest = request;
  fxRange = range;
  const book = state.fxBook ?? emptyFxBook();
  void refreshFxRates(book, from, to, today)
    .then(async updated => {
      if (request !== fxRequest) return;
      fxNextAttempt = Date.now() + 30 * 60_000;
      if (updated === book) return;
      await serial(async () => {
        if (request !== fxRequest || !listJobs(state).some(j => j.currency === "USD")) return;
        const merged = { rates: { ...updated.rates, ...state.fxBook?.rates }, coverage: { ...state.fxBook?.coverage } };
        for (const [start, end] of Object.entries(updated.coverage)) {
          if (!(start in merged.coverage) || merged.coverage[start] < end) merged.coverage[start] = end;
        }
        if (JSON.stringify(merged) !== JSON.stringify(state.fxBook)) await commit({ ...state, fxBook: merged });
      });
    })
    .catch(() => { if (request === fxRequest) fxNextAttempt = Date.now() + 5 * 60_000; })
    .finally(() => { if (request === fxRequest) fxRequest = undefined; });
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
        state.ledger,
      )
    : emptyProgress;
  if (settledCache?.state !== state || settledCache.date !== today)
    settledCache = { state, date: today, totals: settledJobTotals(state, today) };
  const historical = settledCache.totals;
  const daily = combinedDayIncome(state, today, now);
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
    settledCents: historical.settledCny,
    totalCents: historical.settledCny + daily.cnyCents,
    incomeTotals: { ...historical, todayCny: daily.cnyCents, todayPendingUsd: daily.pendingUsdCents },
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
  next = freezeLedgerQuotes(next, dateKey(new Date()));
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
  updateExchangeRates();
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
      await recoverFullBackup(directory);
      const loaded = await loadState(directory);
      state = loaded.state;
      const ai = new AISettings(
        directory,
        process.env.BUDDY_DEVELOPER_BUILD === "1",
        safeStorage,
      );
      await ai.load();
      let transportQueue: Promise<void> = Promise.resolve();
      const transport: typeof chatTransport = (body, signal, delta) => {
        if (body.purpose !== "interaction") interaction.cancel();
        const run = transportQueue.then(async () => {
          signal.throwIfAborted();
          await chatTransport(body, signal, delta, ai.endpoint);
        });
        transportQueue = run.catch(() => {});
        return run;
      };
      const chat = new ChatController(
        await loadChat(directory),
        (s) => saveChat(directory, s),
        (s) => {
          updateDesktopReply(s);
          for (const win of BrowserWindow.getAllWindows())
            if (
              !win.isDestroyed() &&
              (win === panel ||
                (win.isVisible() &&
                  win.webContents.getURL().endsWith("#desktop-chat")))
            )
              win.webContents.send("buddy:chat", s);
        },
        transport,
      );
      const interaction = new InteractionReply(
        transport,
        (text) => {
          showCompanionReply({
            id: crypto.randomUUID(),
            kind: "interaction",
            text,
            createdAt: Date.now(),
            durationMs: 4000,
          });
        },
        () => chat.idle(),
        (kind) => chat.clickContext(kind),
      );
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
      state = prepareJobHistory(state);
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
        if (!isDesktopVisible()) {
          stopEvents();
          interaction.cancel();
        }
        broadcast();
      });
      configureEvents(
        (e) => {
          if (e.text) showCompanionReply(e);
          for (const w of BrowserWindow.getAllWindows())
            w.webContents.send("buddy:companion-event", e);
        },
        () => companion.isVisible(),
      );
      app.on("before-quit", stopEvents);
      registerIpc({
        getAISettings: () => ai.view(),
        saveAISettings: (input: unknown) =>
          serial(async () => {
            if (chat.get().active)
              throw Error("请先停止当前回复，再修改 AI 设置。");
            return ai.save(input);
          }),
        testAISettings: (input: unknown) => serial(() => ai.test(input)),
        openDesktopChat,
        closeDesktopChat,
        getDesktopReply,
        resizeDesktopReply,
        shapeDesktopReply,
        keepDesktopReply,
        hoverDesktopReply,
        getChat: () => chat.get(),
        narrativeAction: (
          input: import("../shared/narrative").NarrativeAction,
        ) =>
          serial(() => {
            const kind = normalizeCharacter(state.preferences.character);
            if (!input || input.actor !== kind)
              throw Error("请先切换到要操作的伙伴。");
            interaction.cancel();
            return chat.narrativeAction(
              kind,
              input,
              characterName(kind, state.preferences),
            );
          }),
        sendChat: (text: unknown) =>
          serial(() =>
            chat.send(
              normalizeCharacter(state.preferences.character),
              characterName(state.preferences.character, state.preferences),
              z.string().trim().min(1).max(2000).parse(text),
            ),
          ),
        retryChat: () =>
          serial(() =>
            chat.retry(
              normalizeCharacter(state.preferences.character),
              characterName(state.preferences.character, state.preferences),
            ),
          ),
        stopChat: () => chat.stop(),
        clearChat: async () => {
          const kind = normalizeCharacter(state.preferences.character);
          const result = await dialog.showMessageBox(panel, {
            type: "question",
            message: `清空 ${characterName(kind, state.preferences)} 的聊天记录？`,
            detail:
              "同时清除这个角色的长期记忆和剧情对话。故事进度保留；不影响其他角色。此操作无法撤销。",
            buttons: ["取消", "清空记录"],
            defaultId: 0,
            cancelId: 0,
          });
          return result.response === 1 ? chat.clear(kind) : chat.get();
        },
        getSnapshot: () => snapshot(),
        saveJob: (input: unknown) => serial(() => commit(saveJob(state, input, new Date()))),
        archiveJob: (id: string, endDate: string) => serial(() =>
          commit(archiveJob(state, id, endDate, new Date()))),
        setPrimaryJob: (id: string) => serial(() => commit(setPrimaryJob(state, id))),
        setPaydayReceived: (id: string, date: string, received: unknown) => serial(() =>
          commit(setPaydayReceived(state, id, date, z.boolean().parse(received), new Date()))),
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
            return commit(settleAllJobs(parseState(next), new Date()));
          }),
        setPreferences: (input: unknown) =>
          serial(async () => {
            const patch = preferencesSchema.partial().parse(input);
            if (patch.character || patch.haruName || patch.characterNames)
              interaction.cancel();
            if (patch.character)
              await chat.switchCharacter(normalizeCharacter(patch.character));
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
        setLeave: (date: unknown, input: unknown, jobId?: string) =>
          serial(() =>
            commit(withJob(state, jobId, scoped => {
              const d = dateSchema.parse(date);
              if (!inJobPeriod(primaryJob(scoped), d)) throw new Error("请假日期须在工作起止日期内");
              return setLeave(scoped, d, leaveSchema.parse(input), new Date());
            })),
          ),
        setDayOverride: (date: unknown, value: unknown, jobId?: string) =>
          serial(() => {
            const d = dateSchema.parse(date),
              v = z.boolean().nullable().parse(value);
            return commit(withJob(state, jobId, scoped => {
              if (!inJobPeriod(primaryJob(scoped), d)) throw new Error("调班日期须在工作起止日期内");
              const overrides = { ...scoped.overrides };
              if (v === null) delete overrides[d];
              else overrides[d] = v;
              return { ...scoped, overrides };
            }));
          }),
        updatePlan: (date: unknown, input: unknown, jobId?: string) =>
          serial(async () => {
            const d = dateSchema.parse(date),
              action = planActionSchema.parse(input);
            const plans = jobId === "personal" ? state.personalPlans : jobState(state, jobId).plans;
            const previous = plans[d]?.find(
              (p) => p.id === action.id,
            )?.completed;
            let next: State;
            if (jobId === "personal") {
              const updated = applyPlanAction({ ...state, plans }, d, action, new Date());
              next = { ...state, personalPlans: updated.plans, growth: updated.growth };
            } else {
              next = withJob(state, jobId, scoped => {
                if (action.type === "add" && !inJobPeriod(primaryJob(scoped), d))
                  throw new Error("计划日期须在工作起止日期内");
                return applyPlanAction(scoped, d, action, new Date());
              });
            }
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
            emitCompanionEvent("interaction", "");
            if (isDesktopVisible())
              void interaction.request(
                normalizeCharacter(state.preferences.character),
                characterName(state.preferences.character, state.preferences),
              );
            return result;
          }),
        recalculate: (from: unknown, to: unknown, jobId?: string) =>
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
            return commit(withJob(state, jobId, scoped => recalculateRange(scoped, f, t, new Date())));
          }),
        exportBackup: () =>
          serial(async () => {
            const r = await dialog.showSaveDialog({
              defaultPath: `下班搭子备份-${dateKey(new Date())}.json`,
              filters: [{ name: "JSON 备份", extensions: ["json"] }],
            });
            if (r.canceled || !r.filePath) return null;
            await chat.flush();
            await writeFile(
              r.filePath,
              JSON.stringify(exportFullBackup(state, chat.get()), null, 2),
              "utf8",
            );
            return r.filePath;
          }),
        importBackup: () =>
          serial(async () => {
            const file = await selectJson();
            if (!file) return false;
            const raw = await readJson(file);
            const checked = validateFullBackup(raw);
            const r = await dialog.showMessageBox({
              type: "warning",
              message: "用这个备份替换当前所有记录？",
              detail: checked.chat
                ? "包含私人聊天、记忆与故事存档；将一并替换。导入前会保留当前数据备份。"
                : "旧版备份仅替换工资、日历和设置，聊天、记忆与故事存档保留。",
              buttons: ["取消", "导入并替换"],
              defaultId: 0,
              cancelId: 0,
            });
            if (r.response !== 1) return false;
            await chat.flush();
            const restored = await importFullBackup(directory, raw, prepareJobHistory);
            state = restored.state;
            resetExchangeRates();
            if (restored.chat) await chat.replace(restored.chat, false);
            updateExchangeRates();
            applyPreferences(state.preferences);
            broadcast();
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
        getEarningsDetail: (date: unknown, id?: unknown) =>
          earningsDetail(id === undefined ? state : jobState(state, z.string().parse(id)), dateSchema.parse(date), new Date()),
        takeNavigation: () => {
          const target = pendingNavigation;
          pendingNavigation = null;
          return target;
        },
        openPanel: (input: unknown) => {
          if (input !== undefined) {
            const target = z
              .union([
                z.object({ page: z.literal("calendar"), date: dateSchema, jobId: z.string().optional() }),
                z.object({ page: z.literal("earnings"), date: dateSchema, jobId: z.string().optional() }),
                z.object({ page: z.literal("growth") }),
                z.object({ page: z.literal("chat") }),
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
        updateExchangeRates();
        if (dateKey(new Date()) !== lastDate)
          void serial(async () => {
            await commit(settleAllJobs(state, new Date()));
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
            interaction.cancel();
            await chat.flush();
            await transportQueue;
            await ai.close();
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
