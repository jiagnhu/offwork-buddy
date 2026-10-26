import type { BrowserWindow } from "electron";
// Keep the desktop surfaces ordered without activating them or unhiding them.
export function raiseDesktopWindows(
  windows: (BrowserWindow | undefined)[],
  enabled: boolean,
) {
  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    win.setAlwaysOnTop(enabled, "screen-saver");
    if (enabled && win.isVisible() && !win.isMinimized()) win.moveTop();
  }
}
