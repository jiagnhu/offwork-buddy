import { ipcMain, BrowserWindow } from "electron";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { ZodError } from "zod";
export function registerIpc(
  handlers: Record<string, (...args: any[]) => unknown>,
) {
  const allowed = pathToFileURL(
    path.join(__dirname, "../renderer/index.html"),
  ).href;
  for (const [name, fn] of Object.entries({
    ...handlers,
    getWindowVisibility: (..._args: any[]) => false,
  }))
    ipcMain.handle("buddy:" + name, async (event, ...args) => {
      try {
        if (
          !event.senderFrame ||
          event.senderFrame !== event.sender.mainFrame ||
          event.senderFrame.url.split("#")[0] !== allowed
        )
          throw new Error("不允许的窗口请求");
        if (
          ["getAISettings", "saveAISettings", "testAISettings"].includes(
            name,
          ) &&
          event.senderFrame.url !== allowed
        )
          throw new Error("仅主面板可以访问 AI 设置");
        const win = BrowserWindow.fromWebContents(event.sender);
        if (
          name === "dragCompanion" &&
          !event.senderFrame.url.endsWith("#companion")
        )
          throw new Error("仅桌面角色可发起拖动");
        return {
          ok: true,
          value:
            name === "getWindowVisibility"
              ? !!win?.isVisible() && !win?.isMinimized()
              : await fn(...args),
        };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof ZodError
              ? [
                  ...new Set(
                    error.issues.map((issue) =>
                      issue.code === "custom" || issue.code === "invalid_string"
                        ? issue.message
                        : "数据格式不正确，请检查输入或备份文件。",
                    ),
                  ),
                ].join("；")
              : error instanceof Error
                ? error.message
                : "操作失败，请重试",
        };
      }
    });
}
