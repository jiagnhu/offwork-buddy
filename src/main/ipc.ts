import { ipcMain } from "electron";
import { pathToFileURL } from "node:url";
import path from "node:path";
export function registerIpc(
  handlers: Record<string, (...args: any[]) => unknown>,
) {
  const allowed = pathToFileURL(
    path.join(__dirname, "../renderer/index.html"),
  ).href;
  for (const [name, fn] of Object.entries(handlers))
    ipcMain.handle("buddy:" + name, async (event, ...args) => {
      try {
        if (
          !event.senderFrame ||
          event.senderFrame !== event.sender.mainFrame ||
          event.senderFrame.url.split("#")[0] !== allowed
        )
          throw new Error("不允许的窗口请求");
        return { ok: true, value: await fn(...args) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "操作失败，请重试",
        };
      }
    });
}
