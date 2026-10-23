import { BrowserWindow, screen, app } from "electron";
import path from "node:path";
import { desktopChatBounds, desktopReplyBounds } from "./desktop-chat-position";
import { ReplyLifetime } from "./desktop-reply-lifetime";
import type { ChatState } from "../shared/chat";
import type { Preferences } from "../shared/model";
import type { DesktopReply } from "../shared/desktop-reply";
import { normalizeCharacter } from "../shared/characters";

let anchor: BrowserWindow;
let chatWindow: BrowserWindow | undefined;
let wanted = false;
let ready = false;
let quitting = false;
let armed = false;
let preferences: Preferences;
let replyWindow: BrowserWindow | undefined;
let replyReady = false;
let replyHeight = 90;
let reply: DesktopReply | null = null;
const lifetime = new ReplyLifetime((message) => {
  if (!message) {
    reply = null;
    if (replyWindow && !replyWindow.isDestroyed()) replyWindow.hide();
    return;
  }
  reply = { message, side: "right", theme: preferences.theme };
  ensureReplyWindow();
  positionDesktopReply();
  if (replyReady && anchor.isVisible()) replyWindow!.showInactive();
});
export function updateDesktopReply(state: ChatState) {
  if (!armed || !preferences || !anchor?.isVisible()) return;
  const message =
    state.sessions[normalizeCharacter(preferences.character)].at(-1);
  if (message?.role === "assistant") lifetime.update(message);
  else lifetime.dismiss();
}
export function getDesktopReply() {
  return reply;
}
export function resizeDesktopReply(height: number) {
  if (!Number.isFinite(height)) return;
  replyHeight = Math.max(64, Math.min(270, Math.ceil(height)));
  positionDesktopReply();
}
export function syncDesktopChatPreferences(prefs: Preferences) {
  if (preferences && preferences.character !== prefs.character)
    lifetime.dismiss();
  preferences = prefs;
  if (reply) reply.theme = prefs.theme;
  positionDesktopChat();
}
function positionDesktopReply() {
  if (
    !replyWindow ||
    replyWindow.isDestroyed() ||
    !anchor ||
    anchor.isDestroyed()
  )
    return;
  const b = anchor.getBounds();
  const next = desktopReplyBounds(
    b,
    screen.getDisplayMatching(b).workArea,
    replyHeight,
  );
  replyWindow.setBounds(next);
  if (replyWindow.isAlwaysOnTop() !== anchor.isAlwaysOnTop())
    replyWindow.setAlwaysOnTop(anchor.isAlwaysOnTop(), "floating");
  if (reply) {
    reply.side = next.x < b.x ? "left" : "right";
    if (replyReady) replyWindow.webContents.send("buddy:desktop-reply", reply);
  }
}
function ensureReplyWindow() {
  if (replyWindow && !replyWindow.isDestroyed()) return;
  replyReady = false;
  const win = new BrowserWindow({
    width: 340,
    height: 90,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    maximizable: false,
    fullscreenable: false,
    title: "伙伴对白",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  replyWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      lifetime.dismiss();
    }
  });
  win.once("ready-to-show", () => {
    replyReady = true;
    if (reply && anchor.isVisible()) {
      positionDesktopReply();
      win.showInactive();
    }
  });
  void win.loadFile(path.join(__dirname, "../renderer/index.html"), {
    hash: "desktop-reply",
  });
}

export function positionDesktopChat() {
  positionDesktopReply();
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
  const hide = () => {
    armed = false;
    closeDesktopChat();
    lifetime.dismiss();
  };
  character.on("hide", hide);
  character.on("minimize", hide);
  character.on("always-on-top-changed", positionDesktopChat);
  screen.on("display-metrics-changed", positionDesktopChat);
  screen.on("display-removed", positionDesktopChat);
  app.on("before-quit", () => {
    quitting = true;
    lifetime.dismiss();
  });
}
export function openDesktopChat() {
  if (!anchor?.isVisible() || anchor.isMinimized()) return;
  wanted = true;
  armed = true;
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
