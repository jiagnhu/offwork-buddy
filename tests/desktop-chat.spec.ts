import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { launchDesktop } from "./desktop-helper";
test("comic reply is separate, expires after completion and keeps input minimal", async () => {
  test.setTimeout(120000);
  let requests = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    const n = ++requests;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(
      'data: {"type":"delta","text":"今天辛苦啦！先伸个懒腰，我就在这里陪你。"}\n\n',
    );
    const timer = setTimeout(
      () =>
        res.end(
          n === 2
            ? 'data: {"type":"error","message":"回复中断，请重试。"}\n\n'
            : 'data: {"type":"done"}\n\n',
        ),
      1800,
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
    await expect(chat.locator("button")).toHaveCount(1);
    await expect(chat.locator("header")).toHaveCount(0);
    await expect(chat.locator(".comic-bubble")).toHaveCount(0);
    await input.fill("今天好累");
    await input.dispatchEvent("compositionstart");
    await input.press("Enter");
    expect(requests).toBe(0);
    await input.dispatchEvent("compositionend");
    await input.press("Enter");
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-reply")),
      )
      .toBe(true);
    const bubble = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-reply"))!;
    await expect(bubble.getByLabel("伙伴对白")).toContainText("今天辛苦啦");
    await expect(bubble.locator("textarea")).toHaveCount(0);
    await expect(bubble.getByLabel("伙伴对白")).toHaveAttribute(
      "data-status",
      "complete",
    );
    await bubble.screenshot({ path: "test-results/comic-reply.png" });
    await chat.screenshot({ path: "test-results/comic-input.png" });
    expect(
      await bubble.evaluate(() => window.buddy.getWindowVisibility()),
    ).toBe(true);
    await expect
      .poll(() => bubble.evaluate(() => window.buddy.getWindowVisibility()), {
        timeout: 12000,
      })
      .toBe(false);
    expect(await chat.evaluate(() => window.buddy.getWindowVisibility())).toBe(
      true,
    );
    await input.fill("草稿");
    await input.press("Escape");
    await pet.evaluate(() => window.buddy.openDesktopChat());
    await expect(input).toHaveValue("草稿");
    expect(
      await bubble.evaluate(() => window.buddy.getWindowVisibility()),
    ).toBe(false);
    await input.fill("再说一句");
    await input.press("Enter");
    await expect(chat.getByRole("button", { name: "重新回复" })).toBeVisible();
    await chat.getByRole("button", { name: "重新回复" }).click();
    await expect(bubble.getByLabel("伙伴对白")).toHaveAttribute(
      "data-status",
      "complete",
    );
    await expect
      .poll(() => bubble.evaluate(() => window.buddy.getWindowVisibility()))
      .toBe(true);
    // Independent windows follow their own anchors.
    const placement = await s.app.evaluate(
      async ({ BrowserWindow, screen }) => {
        const pet = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("#companion"),
        )!;
        const area = screen.getDisplayMatching(pet.getBounds()).workArea,
          b = pet.getBounds();
        pet.setPosition(
          area.x + area.width - b.width,
          area.y + area.height - b.height,
        );
        await new Promise((r) => setTimeout(r, 200));
        const input = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("#desktop-chat"),
        )!;
        const bubble = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("#desktop-reply"),
        )!;
        return {
          pet: pet.getBounds(),
          input: input.getBounds(),
          bubble: bubble.getBounds(),
          area,
          focusable: bubble.isFocusable(),
        };
      },
    );
    expect(placement.input.height).toBe(72);
    expect(placement.bubble.y + placement.bubble.height).toBeLessThan(
      placement.input.y,
    );
    expect(placement.bubble.x + placement.bubble.width).toBeLessThanOrEqual(
      placement.pet.x,
    );
    expect(placement.focusable).toBe(false);
    await expect(bubble.locator(".comic-wrap")).toHaveAttribute(
      "data-side",
      "left",
    );
    await chat.evaluate(() => window.buddy.setPreferences({ theme: "dark" }));
    await expect(bubble.locator("html")).toHaveAttribute("data-theme", "dark");
    await bubble.screenshot({ path: "test-results/comic-reply-dark.png" });
    await input.fill("停止");
    await input.press("Enter");
    await chat.getByRole("button", { name: "停止回复" }).click();
    await expect(bubble.getByLabel("伙伴对白")).toHaveAttribute(
      "data-status",
      "stopped",
    );
    await chat.evaluate(() =>
      window.buddy.setPreferences({ character: "mao" }),
    );
    await expect(input).toHaveValue("");
    expect(
      await bubble.evaluate(() => window.buddy.getWindowVisibility()),
    ).toBe(false);
    await chat.evaluate(() => window.buddy.hideCompanion());
    expect(await chat.evaluate(() => window.buddy.getWindowVisibility())).toBe(
      false,
    );
    await chat.evaluate(() => window.buddy.showCompanion());
    expect(
      await bubble.evaluate(() => window.buddy.getWindowVisibility()),
    ).toBe(false);
    await s.page.evaluate(() => window.buddy.openPanel({ page: "chat" }));
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ character: "haru" }),
    );
    await expect(s.page.locator(".chat-message.user")).toHaveCount(3);
  } finally {
    await s.cleanup();
    server.closeAllConnections();
    server.close();
    if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
    else process.env.BUDDY_CHAT_SERVICE = old;
  }
});
