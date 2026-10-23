import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { launchDesktop } from "./desktop-helper";
test("chat streams, retries, isolates characters and persists across restart", async () => {
  test.setTimeout(120000);
  let requests = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    requests++;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(
      `data: ${JSON.stringify({ type: "delta", text: "你好，我在这里。" })}\n\n`,
    );
    const timer = setTimeout(() => {
      if (requests === 1)
        res.end(
          `data: ${JSON.stringify({ type: "error", message: "回复中断，请重试。" })}\n\n`,
        );
      else res.end('data: {"type":"done"}\n\n');
    }, 700);
    res.on("close", () => clearTimeout(timer));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const old = process.env.BUDDY_CHAT_SERVICE;
  process.env.BUDDY_CHAT_SERVICE = `http://127.0.0.1:${(server.address() as any).port}`;
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    await s.page.evaluate(() => window.buddy.openPanel({ page: "chat" }));
    await expect(
      s.page.getByRole("heading", { name: "Haru", exact: true }),
    ).toBeVisible();
    const input = s.page.getByRole("textbox", { name: "聊天内容" });
    await input.fill("输入法测试");
    await input.dispatchEvent("compositionstart");
    await input.press("Enter");
    expect(requests).toBe(0);
    await input.dispatchEvent("compositionend");
    await s.page.getByRole("textbox", { name: "聊天内容" }).fill("今天有点累");
    await s.page.getByRole("button", { name: "发送", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "停止回复" }),
    ).toBeVisible();
    await expect(
      s.page.getByRole("button", { name: "重新回复" }),
    ).toBeVisible();
    await s.page.getByRole("button", { name: "重新回复" }).click();
    await expect(s.page.locator(".chat-message.assistant")).toHaveAttribute(
      "data-status",
      "complete",
    );
    await expect(s.page.locator(".chat-message.user")).toHaveCount(1);
    await s.page.getByRole("textbox", { name: "聊天内容" }).fill("第二句话");
    await s.page.getByRole("button", { name: "发送", exact: true }).click();
    await s.page.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect(s.page.locator(".calendar-grid")).toBeVisible();
    await s.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    await expect(
      s.page.locator(".chat-message.assistant").last(),
    ).toHaveAttribute("data-status", "complete");
    await s.page.getByRole("textbox", { name: "聊天内容" }).fill("暂时停一下");
    await s.page.getByRole("button", { name: "发送", exact: true }).click();
    await s.page.getByRole("button", { name: "停止回复" }).click();
    await expect(
      s.page.locator(".chat-message.assistant").last(),
    ).toHaveAttribute("data-status", "stopped");
    await s.page
      .getByRole("combobox", { name: "聊天伙伴" })
      .selectOption("mao");
    await expect(s.page.locator(".chat-message")).toHaveCount(0);
    await s.page
      .getByRole("combobox", { name: "聊天伙伴" })
      .selectOption("haru");
    await expect(s.page.locator(".chat-message.user")).toHaveCount(3);
    await s.page.screenshot({ path: "test-results/chat-light.png" });
    await s.page.getByRole("button", { name: "切换主题", exact: true }).click();
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: "test-results/chat-dark.png" });
    const r = await s.restart();
    await r.page.evaluate(() => window.buddy.hideCompanion());
    await r.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    await expect(r.page.locator(".chat-message.user")).toHaveCount(3);
    // restart replaces ElectronApplication; use the returned application's native dialog seam.
    await r.app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await r.page.getByRole("button", { name: "清空聊天记录" }).click();
    await expect(r.page.locator(".chat-message")).toHaveCount(0);
  } finally {
    await s.cleanup();
    server.closeAllConnections();
    server.close();
    if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
    else process.env.BUDDY_CHAT_SERVICE = old;
  }
});
