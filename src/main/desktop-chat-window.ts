import { BrowserWindow, screen, app } from "electron";
import path from "node:path";
import { desktopChatBounds } from "./desktop-chat-position";

let anchor: BrowserWindow;
let chatWindow: BrowserWindow | undefined;
let wanted = false;
let ready = false;
let quitting = false;

export function positionDesktopChat() {
  if (
    !chatWindow ||
    chatWindow.isDestroyed() ||
    !anchor ||
    anchor.isDestroyed()
  )
    return;
  const b = anchor.getBounds();
  chatWindow.setBounds(
    desktopChatBounds(b, screen.getDisplayMatching(b).workArea),
  );
  chatWindow.setAlwaysOnTop(anchor.isAlwaysOnTop(), "floating");
}
export function closeDesktopChat() {
  wanted = false;
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
}
export function initializeDesktopChat(character: BrowserWindow) {
  anchor = character;
  character.on("move", positionDesktopChat);
  character.on("resize", positionDesktopChat);
  character.on("hide", closeDesktopChat);
  character.on("minimize", closeDesktopChat);
  character.on("always-on-top-changed", positionDesktopChat);
  screen.on("display-metrics-changed", positionDesktopChat);
  screen.on("display-removed", positionDesktopChat);
  app.on("before-quit", () => {
    quitting = true;
  });
}
export function openDesktopChat() {
  if (!anchor?.isVisible() || anchor.isMinimized()) return;
  wanted = true;
  if (!chatWindow || chatWindow.isDestroyed()) {
    ready = false;
    const win = new BrowserWindow({
      width: 340,
      height: 390,
      show: false,
      transparent: true,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      maximizable: false,
      fullscreenable: false,
      title: "和伙伴聊天",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    chatWindow = win;
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    const visibility = () =>
      win.webContents.send("buddy:window-visibility", win.isVisible());
    win.on("show", visibility);
    win.on("hide", visibility);
    win.on("close", (e) => {
      if (!quitting) {
        e.preventDefault();
        closeDesktopChat();
      }
    });
    win.once("ready-to-show", () => {
      ready = true;
      if (wanted && anchor.isVisible()) {
        positionDesktopChat();
        win.show();
        win.focus();
      }
    });
    void win.loadFile(path.join(__dirname, "../renderer/index.html"), {
      hash: "desktop-chat",
    });
  }
  positionDesktopChat();
  if (ready) {
    chatWindow.show();
    chatWindow.focus();
  }
}
