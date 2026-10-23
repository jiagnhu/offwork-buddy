import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { launchDesktop } from "./desktop-helper";
test("desktop chat opens, streams, preserves drafts and shares panel history", async () => {
  test.setTimeout(120000);
  let requests = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    requests++;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"type":"delta","text":"你好，我就在你身边。"}\n\n');
    const request = requests;
    const timer = setTimeout(
      () =>
        res.end(
          request === 2
            ? 'data: {"type":"error","message":"回复中断，请重试。"}\n\n'
            : 'data: {"type":"done"}\n\n',
        ),
      1200,
    );
    res.on("close", () => clearTimeout(timer));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const old = process.env.BUDDY_CHAT_SERVICE;
  process.env.BUDDY_CHAT_SERVICE = `http://127.0.0.1:${(server.address() as any).port}`;
  const s = await launchDesktop();
  try {
    await expect
      .poll(() => s.app.windows().some((w) => w.url().endsWith("#companion")))
      .toBe(true);
    const pet = s.app.windows().find((w) => w.url().endsWith("#companion"))!;
    await pet
      .getByRole("button", { name: "和伙伴聊天" })
      .click({ force: true });
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-chat")),
      )
      .toBe(true);
    const chat = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-chat"))!;
    const input = chat.getByRole("textbox", { name: "桌面聊天内容" });
    await expect(input).toBeVisible();
    await input.fill("今天过得怎么样");
    await input.dispatchEvent("compositionstart");
    await input.press("Enter");
    expect(requests).toBe(0);
    await input.dispatchEvent("compositionend");
    await input.press("Enter");
    await expect(chat.getByRole("button", { name: "停止回复" })).toBeVisible();
    await chat.getByRole("button", { name: "收起聊天" }).click();
    await expect
      .poll(() => chat.evaluate(() => window.buddy.getWindowVisibility()))
      .toBe(false);
    await expect
      .poll(
        async () => (await chat.evaluate(() => window.buddy.getChat())).active,
      )
      .toBeNull();
    expect(await chat.evaluate(() => window.buddy.getWindowVisibility())).toBe(
      false,
    );
    await pet
      .getByRole("button", { name: "和伙伴聊天" })
      .click({ force: true });
    await expect(chat.locator(".desktop-chat-reply")).toContainText(
      "你好，我就在你身边。",
    );
    await input.fill("尚未发送的草稿");
    await input.press("Escape");
    await pet.evaluate(() => window.buddy.openDesktopChat());
    await expect(input).toHaveValue("尚未发送的草稿");
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ character: "mao" }),
    );
    await expect(input).toHaveValue("");
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ character: "haru" }),
    );
    await expect(input).toHaveValue("尚未发送的草稿");
    await chat.screenshot({ path: "test-results/desktop-chat.png" });
    await chat.getByRole("button", { name: "查看完整聊天" }).click();
    await expect(s.page.locator(".chat-message.user")).toHaveCount(1);
    await expect(s.page.locator(".chat-message.assistant")).toContainText(
      "你好，我就在你身边。",
    );
    expect(requests).toBe(1);
    await pet.evaluate(() => window.buddy.openDesktopChat());
    await s.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("index.html"))!
        .hide();
    });
    await input.fill("失败后再试一次");
    await input.press("Enter");
    await expect(chat.getByRole("button", { name: "重新回复" })).toBeVisible();
    await chat.getByRole("button", { name: "重新回复" }).click();
    await expect(chat.locator(".desktop-chat-reply")).toHaveAttribute(
      "data-status",
      "complete",
    );
    expect(requests).toBe(3);
    await input.fill("停止这一次");
    await input.press("Enter");
    await chat.getByRole("button", { name: "停止回复" }).click();
    await expect(chat.locator(".desktop-chat-reply")).toHaveAttribute(
      "data-status",
      "stopped",
    );
    const placement = await s.app.evaluate(
      async ({ BrowserWindow, screen }) => {
        const pet = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("#companion"),
        )!;
        const chat = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("#desktop-chat"),
        )!;
        const area = screen.getDisplayMatching(pet.getBounds()).workArea;
        const b = pet.getBounds();
        pet.setPosition(
          area.x + area.width - b.width,
          area.y + area.height - b.height,
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { pet: pet.getBounds(), chat: chat.getBounds(), area };
      },
    );
    expect(placement.chat.x).toBeGreaterThanOrEqual(placement.area.x);
    expect(placement.chat.x + placement.chat.width).toBeLessThanOrEqual(
      placement.pet.x,
    );
    expect(placement.chat.y + placement.chat.height).toBeLessThanOrEqual(
      placement.area.y + placement.area.height,
    );
    await chat.evaluate(() => window.buddy.setPreferences({ theme: "dark" }));
    await expect(chat.locator("html")).toHaveAttribute("data-theme", "dark");
    await chat.screenshot({ path: "test-results/desktop-chat-dark.png" });
    await chat.evaluate(() => window.buddy.hideCompanion());
    expect(await chat.evaluate(() => window.buddy.getWindowVisibility())).toBe(
      false,
    );
    await chat.evaluate(() => window.buddy.showCompanion());
    expect(await chat.evaluate(() => window.buddy.getWindowVisibility())).toBe(
      false,
    );
    await chat.evaluate(() => window.buddy.setPreferences({ theme: "light" }));
    await expect(chat.locator("html")).toHaveAttribute("data-theme", "dark");
    await pet.evaluate(() => window.buddy.openDesktopChat());
    await expect(chat.locator("html")).toHaveAttribute("data-theme", "light");
  } finally {
    await s.cleanup();
    server.closeAllConnections();
    server.close();
    if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
    else process.env.BUDDY_CHAT_SERVICE = old;
  }
});
