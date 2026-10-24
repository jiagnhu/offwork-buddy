import { BrowserWindow, screen, app } from "electron";
import path from "node:path";
import { desktopChatBounds, desktopReplyBounds } from "./desktop-chat-position";
import { ReplyLifetime } from "./desktop-reply-lifetime";
import type { ChatState } from "../shared/chat";
import type { CompanionEvent, Preferences } from "../shared/model";
import type { DesktopReply } from "../shared/desktop-reply";
import { normalizeCharacter } from "../shared/characters";
import { clampBounds } from "./bounds";

let anchor: BrowserWindow;
let chatWindow: BrowserWindow | undefined;
let wanted = false;
let ready = false;
let quitting = false;
let armed = false;
let preferences: Preferences;
let replyWindow: BrowserWindow | undefined;
let replyReady = false;
let replyHeight = 100;
let visualHeight = 100;
let targetReplyHeight = 100;
let inputDetached = false;
let reply: DesktopReply | null = null;
let replyEventKind: CompanionEvent["kind"] | null = null;
let pendingEvents: CompanionEvent[] = [];
const lifetime = new ReplyLifetime((message) => {
  if (!message) {
    reply = null;
    replyEventKind = null;
    if (replyWindow && !replyWindow.isDestroyed()) replyWindow.hide();
    const next = pendingEvents.shift();
    if (next) queueMicrotask(() => showCompanionReply(next));
    return;
  }
  if (reply?.message.id !== message.id) {
    replyHeight = 100;
    targetReplyHeight = 100;
    visualHeight = 100;
  }
  reply = {
    message,
    side: "right",
    theme: preferences.theme,
    maxHeight:
      screen.getDisplayMatching(anchor.getBounds()).workArea.height - 20,
  };
  ensureReplyWindow();
  positionDesktopReply();
  if (replyReady && anchor.isVisible() && !replyWindow!.isVisible())
    replyWindow!.showInactive();
});
export function updateDesktopReply(state: ChatState) {
  if (!armed || !preferences || !anchor?.isVisible()) return;
  const message =
    state.sessions[normalizeCharacter(preferences.character)].at(-1);
  if (message?.role === "assistant") lifetime.update(message);
  else lifetime.dismiss();
}
export function showCompanionReply(event: CompanionEvent) {
  if (!preferences || !anchor?.isVisible()) return;
  // Preserve an AI reply while it is being generated or read.
  if (
    reply &&
    (!reply.message.id.startsWith("event:") ||
      (event.kind === "interaction" && replyEventKind !== "interaction"))
  ) {
    // Reminders must remain readable after the AI reply, even if it is hovered.
    pendingEvents = pendingEvents.filter(
      (item) =>
        item.kind !== event.kind ||
        (event.kind !== "interaction" && item.text !== event.text),
    );
    pendingEvents.push(event);
    return;
  }
  const message = {
    id: "event:" + event.id,
    role: "assistant" as const,
    content: event.text,
    at: event.createdAt,
    status: "streaming" as const,
  };
  replyEventKind = event.kind;
  lifetime.update(message);
  lifetime.update({ ...message, status: "complete" });
}
export function hoverDesktopReply(hovered: unknown) {
  if (typeof hovered === "boolean") lifetime.setHovered(hovered);
}
export function getDesktopReply() {
  return reply;
}
export function resizeDesktopReply(height: number) {
  if (!Number.isFinite(height)) return;
  const limit =
    screen.getDisplayMatching(anchor.getBounds()).workArea.height - 20;
  targetReplyHeight = Math.max(1, Math.min(limit, Math.ceil(height)));
  if (targetReplyHeight <= replyHeight) {
    if (Math.abs(visualHeight - targetReplyHeight) <= 1) settleReplySize();
    return;
  }
  const next = Math.max(
    replyHeight,
    Math.min(limit, Math.ceil(height / 64) * 64),
  );
  if (next === replyHeight) return;
  replyHeight = next;
  positionDesktopReply();
}
export function shapeDesktopReply(height: number) {
  if (!Number.isFinite(height)) return;
  visualHeight = Math.max(1, Math.min(replyHeight, Math.ceil(height)));
  applyReplyShape();
  if (Math.abs(visualHeight - targetReplyHeight) <= 1) settleReplySize();
}
function settleReplySize() {
  if (replyHeight === targetReplyHeight) return;
  replyHeight = targetReplyHeight;
  positionDesktopReply();
}
export function keepDesktopReply() {
  lifetime.keepAlive();
}
function applyReplyShape() {
  if (!replyWindow || replyWindow.isDestroyed()) return;
  const b = replyWindow.getBounds();
  // Allocate space ahead of the CSS height animation. The unused
  // transparent area must not intercept clicks intended for the desktop.
  replyWindow.setShape([
    { x: 0, y: 0, width: b.width, height: Math.min(visualHeight, b.height) },
  ]);
}
export function syncDesktopChatPreferences(prefs: Preferences) {
  if (preferences && preferences.character !== prefs.character) {
    pendingEvents = [];
    lifetime.dismiss();
  }
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
  const previous = replyWindow.getBounds();
  if (
    previous.x !== next.x ||
    previous.y !== next.y ||
    previous.width !== next.width ||
    previous.height !== next.height
  ) {
    replyWindow.setBounds(next);
    applyReplyShape();
  }
  if (replyWindow.isAlwaysOnTop() !== anchor.isAlwaysOnTop())
    replyWindow.setAlwaysOnTop(anchor.isAlwaysOnTop(), "floating");
  if (reply) {
    reply.maxHeight = screen.getDisplayMatching(b).workArea.height - 20;
    reply.side = next.x < b.x ? "left" : "right";
    if (replyReady) replyWindow.webContents.send("buddy:desktop-reply", reply);
  }
}
function ensureReplyWindow() {
  if (replyWindow && !replyWindow.isDestroyed()) return;
  replyReady = false;
  const win = new BrowserWindow({
    width: 340,
    height: 100,
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
  applyReplyShape();
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
  const next = inputDetached
    ? clampBounds(
        chatWindow.getBounds(),
        screen.getAllDisplays().map((d) => d.workArea),
      )
    : desktopChatBounds(b, screen.getDisplayMatching(b).workArea);
  const old = chatWindow.getBounds();
  if (
    old.x !== next.x ||
    old.y !== next.y ||
    old.width !== next.width ||
    old.height !== next.height
  )
    chatWindow.setBounds(next);
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
    pendingEvents = [];
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
    pendingEvents = [];
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
    win.on("will-move", () => {
      inputDetached = true;
    });
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
