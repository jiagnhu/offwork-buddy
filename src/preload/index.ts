import { contextBridge, ipcRenderer } from "electron";
import type { BuddyBridge } from "../shared/bridge";
const invoke = <T>(method: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer
    .invoke("buddy:" + method, ...args)
    .then((r: { ok: boolean; value: T; error?: string }) => {
      if (!r.ok) throw new Error(r.error);
      return r.value;
    });
const bridge: BuddyBridge = {
  getDesktopReply: () => invoke("getDesktopReply"),
  resizeDesktopReply: (height) => invoke("resizeDesktopReply", height),
  shapeDesktopReply: (height) => invoke("shapeDesktopReply", height),
  hoverDesktopReply: (hovered) => invoke("hoverDesktopReply", hovered),
  keepDesktopReply: () => invoke("keepDesktopReply"),
  onDesktopReply: (listener) => {
    const fn = (_: unknown, reply: any) => listener(reply);
    ipcRenderer.on("buddy:desktop-reply", fn);
    return () => ipcRenderer.removeListener("buddy:desktop-reply", fn);
  },
  openDesktopChat: () => invoke("openDesktopChat"),
  closeDesktopChat: () => invoke("closeDesktopChat"),
  getAISettings: () => invoke("getAISettings"),
  saveAISettings: (input) => invoke("saveAISettings", input),
  testAISettings: (input) => invoke("testAISettings", input),
  getChat: () => invoke("getChat"),
  narrativeAction: (input) => invoke("narrativeAction", input),
  sendChat: (text) => invoke("sendChat", text),
  retryChat: () => invoke("retryChat"),
  stopChat: () => invoke("stopChat"),
  clearChat: () => invoke("clearChat"),
  onChat: (listener) => {
    const fn = (_: unknown, state: any) => listener(state);
    ipcRenderer.on("buddy:chat", fn);
    return () => ipcRenderer.removeListener("buddy:chat", fn);
  },
  dragCompanion: (input) => invoke("dragCompanion", input),
  getWindowVisibility: () => invoke("getWindowVisibility"),
  onWindowVisibility: (listener) => {
    const fn = (_: unknown, value: boolean) => listener(value);
    ipcRenderer.on("buddy:window-visibility", fn);
    return () => ipcRenderer.removeListener("buddy:window-visibility", fn);
  },
  getSnapshot: () => invoke("getSnapshot"),
  saveSettings: (i) => invoke("saveSettings", i),
  saveJob: (input) => invoke("saveJob", input),
  archiveJob: (id, endDate) => invoke("archiveJob", id, endDate),
  setPrimaryJob: (id) => invoke("setPrimaryJob", id),
  setPaydayReceived: (id, date, received) =>
    invoke("setPaydayReceived", id, date, received),
  setPreferences: (i) => invoke("setPreferences", i),
  setLeave: (d, v, jobId) => invoke("setLeave", d, v, jobId),
  setDayOverride: (d, v, jobId) => invoke("setDayOverride", d, v, jobId),
  updatePlan: (d, p, jobId) => invoke("updatePlan", d, p, jobId),
  interact: () => invoke("interact"),
  onCompanionEvent: (listener) => {
    const fn = (_: unknown, e: any) => listener(e);
    ipcRenderer.on("buddy:companion-event", fn);
    return () => ipcRenderer.removeListener("buddy:companion-event", fn);
  },
  recalculate: (f, t, jobId) => invoke("recalculate", f, t, jobId),
  exportBackup: () => invoke("exportBackup"),
  importBackup: () => invoke("importBackup"),
  importCalendar: () => invoke("importCalendar"),
  getEarningsDetail: (d, jobId) => invoke("getEarningsDetail", d, jobId),
  openPanel: (target) => invoke("openPanel", target),
  takeNavigation: () => invoke("takeNavigation"),
  onNavigate: (listener) => {
    const fn = (_: unknown, target: any) => listener(target);
    ipcRenderer.on("buddy:navigate", fn);
    return () => ipcRenderer.removeListener("buddy:navigate", fn);
  },
  hideCompanion: () => invoke("hideCompanion"),
  showCompanion: () => invoke("showCompanion"),
  setCardHidden: (hidden) => invoke("setCardHidden", hidden),
  recallCompanion: () => invoke("recallCompanion"),
  onSnapshot: (listener) => {
    const fn = (_: unknown, value: any) => listener(value);
    ipcRenderer.on("buddy:snapshot", fn);
    return () => ipcRenderer.removeListener("buddy:snapshot", fn);
  },
};
contextBridge.exposeInMainWorld("buddy", bridge);
