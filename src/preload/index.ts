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
  dragCompanion: (input) => invoke("dragCompanion", input),
  getWindowVisibility: () => invoke("getWindowVisibility"),
  onWindowVisibility: (listener) => {
    const fn = (_: unknown, value: boolean) => listener(value);
    ipcRenderer.on("buddy:window-visibility", fn);
    return () => ipcRenderer.removeListener("buddy:window-visibility", fn);
  },
  getSnapshot: () => invoke("getSnapshot"),
  saveSettings: (i) => invoke("saveSettings", i),
  setPreferences: (i) => invoke("setPreferences", i),
  setLeave: (d, v) => invoke("setLeave", d, v),
  setDayOverride: (d, v) => invoke("setDayOverride", d, v),
  updatePlan: (d, p) => invoke("updatePlan", d, p),
  interact: () => invoke("interact"),
  onCompanionEvent: (listener) => {
    const fn = (_: unknown, e: any) => listener(e);
    ipcRenderer.on("buddy:companion-event", fn);
    return () => ipcRenderer.removeListener("buddy:companion-event", fn);
  },
  recalculate: (f, t) => invoke("recalculate", f, t),
  exportBackup: () => invoke("exportBackup"),
  importBackup: () => invoke("importBackup"),
  importCalendar: () => invoke("importCalendar"),
  getEarningsDetail: (d) => invoke("getEarningsDetail", d),
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
