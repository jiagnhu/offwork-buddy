import { app, BrowserWindow, Menu, Tray, screen, nativeImage } from "electron";
import path from "node:path";
import type { Preferences } from "../shared/model";
import { clampBounds } from "./bounds";
export let panel: BrowserWindow, companion: BrowserWindow;
let tray: Tray;
let quitting = false;
let currentPreferences: Preferences;
const page = path.join(__dirname, "../renderer/index.html");
export function openPanel() {
  panel.show();
  panel.focus();
}
export function showCompanion() {
  applyPreferences(currentPreferences);
  if (companion.isMinimized()) companion.restore();
  companion.show();
  if (currentPreferences.alwaysOnTop) companion.moveTop();
}
export function createWindows(
  prefs: Preferences,
  onPosition: (p: { x: number; y: number }) => void,
  onToggleTop: () => void,
) {
  const webPreferences = {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
  panel = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 880,
    minHeight: 660,
    title: "下班搭子",
    backgroundColor: "#f7f8fa",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../resources/icon.png"),
    webPreferences,
  });
  companion = new BrowserWindow({
    width: 360,
    height: 500,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: prefs.alwaysOnTop,
    hasShadow: false,
    webPreferences,
  });
  Menu.setApplicationMenu(null);
  for (const win of [panel, companion]) {
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
  }
  void panel.loadFile(page);
  void companion.loadFile(page, { hash: "companion" });
  panel.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      panel.hide();
    }
  });
  companion.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      companion.hide();
    }
  });
  const area = screen.getPrimaryDisplay().workArea;
  companion.setPosition(
    prefs.position?.x ?? area.x + area.width - 390,
    prefs.position?.y ?? area.y + area.height - 540,
  );
  let timer: ReturnType<typeof setTimeout>;
  companion.on("moved", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!quitting) {
        const [x, y] = companion.getPosition();
        onPosition({ x, y });
      }
    }, 300);
  });
  const icon = nativeImage
    .createFromPath(path.join(__dirname, "../resources/icon.png"))
    .resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip("下班搭子 · 每一秒，都有回报");
  tray.on("double-click", openPanel);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开下班搭子", click: openPanel },
      {
        label: "显示 / 隐藏桌面伙伴",
        click: () =>
          companion.isVisible() ? companion.hide() : showCompanion(),
      },
      { label: "切换置顶", click: onToggleTop },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]),
  );
  app.on("before-quit", () => {
    quitting = true;
    clearTimeout(timer);
  });
  screen.on("display-removed", () => applyPreferences(currentPreferences));
  screen.on("display-metrics-changed", () =>
    applyPreferences(currentPreferences),
  );
  applyPreferences(prefs);
}
export function applyPreferences(prefs: Preferences) {
  const previous = currentPreferences;
  currentPreferences = prefs;
  if (!companion || companion.isDestroyed()) return;
  if (companion.isAlwaysOnTop() !== prefs.alwaysOnTop)
    companion.setAlwaysOnTop(prefs.alwaysOnTop, "floating");
  const bounds = companion.getBounds();
  const target = clampBounds(
    {
      ...bounds,
      width: Math.round(360 * prefs.scale),
      height: Math.round((prefs.collapsed ? 290 : 500) * prefs.scale),
    },
    screen.getAllDisplays().map((d) => d.workArea),
  );
  if (
    bounds.x !== target.x ||
    bounds.y !== target.y ||
    bounds.width !== target.width ||
    bounds.height !== target.height
  )
    companion.setBounds(target);
  if (app.isPackaged && (!previous || previous.autoStart !== prefs.autoStart))
    app.setLoginItemSettings({ openAtLogin: prefs.autoStart });
}
