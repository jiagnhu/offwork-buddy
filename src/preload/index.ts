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
  getSnapshot: () => invoke("getSnapshot"),
  saveSettings: (i) => invoke("saveSettings", i),
  setPreferences: (i) => invoke("setPreferences", i),
  setDayOverride: (d, v) => invoke("setDayOverride", d, v),
  updatePlan: (d, p) => invoke("updatePlan", d, p),
  interact:()=>invoke('interact'),
  onCompanionEvent:(listener)=>{const fn=(_:unknown,e:any)=>listener(e);ipcRenderer.on('buddy:companion-event',fn);return()=>ipcRenderer.removeListener('buddy:companion-event',fn)},
  recalculate: (f, t) => invoke("recalculate", f, t),
  exportBackup: () => invoke("exportBackup"),
  importBackup: () => invoke("importBackup"),
  importCalendar: () => invoke("importCalendar"),
  getEarningsDetail: (d) => invoke('getEarningsDetail',d),
  openPanel: (target) => invoke("openPanel",target),
  takeNavigation:()=>invoke('takeNavigation'),
  onNavigate:(listener)=>{const fn=(_:unknown,target:any)=>listener(target);ipcRenderer.on('buddy:navigate',fn);return ()=>ipcRenderer.removeListener('buddy:navigate',fn)},
  hideCompanion: () => invoke("hideCompanion"),
  showCompanion: () => invoke("showCompanion"),
  onSnapshot: (listener) => {
    const fn = (_: unknown, value: any) => listener(value);
    ipcRenderer.on("buddy:snapshot", fn);
    return () => ipcRenderer.removeListener("buddy:snapshot", fn);
  },
};
contextBridge.exposeInMainWorld("buddy", bridge);
