import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { launchDesktop } from "./desktop-helper";
test("long replies grow then paginate without scrolling; input fades and moves; compact clock", async () => {
  test.setTimeout(120000);
  const text =
    "今天也辛苦了。先放松肩膀，慢慢呼吸，然后再开始下一件事情。\n".repeat(70);
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"type":"delta","text":"你好"}\n\n');
    const timer = setTimeout(() => {
      res.write("data: " + JSON.stringify({ type: "delta", text }) + "\n\n");
      res.end('data: {"type":"done"}\n\n');
    }, 1500);
    res.on("close", () => clearTimeout(timer));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const old = process.env.BUDDY_CHAT_SERVICE;
  process.env.BUDDY_CHAT_SERVICE = `http://127.0.0.1:${(server.address() as any).port}`;
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.openDesktopChat());
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-chat")),
      )
      .toBe(true);
    const inputWindow = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-chat"))!;
    const input = inputWindow.getByRole("textbox", { name: "桌面聊天内容" });
    await expect(input).toBeVisible();
    await inputWindow.mouse.move(160, 30);
    await expect
      .poll(() =>
        inputWindow
          .locator(".desktop-input")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBe(1);
    await inputWindow.mouse.move(0, 0);
    await expect
      .poll(() =>
        inputWindow
          .locator(".desktop-input")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBe(0.16);
    expect(
      await inputWindow
        .locator(".desktop-input-drag")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("-webkit-app-region"),
        ),
    ).toBe("drag");
    // Native dragging detaches the input from the character; subsequent moves must not snap it back.
    const moved = await s.app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("#desktop-chat"),
      )!;
      w.emit("will-move", {} as any, { x: 80, y: 100, width: 320, height: 72 });
      w.setPosition(80, 100);
      return w.getBounds();
    });
    await inputWindow.evaluate(() => window.buddy.closeDesktopChat());
    await s.page.evaluate(() => window.buddy.openDesktopChat());
    const after = await s.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#desktop-chat"))!
        .getBounds(),
    );
    expect(after.x).toBe(moved.x);
    expect(after.y).toBe(moved.y);
    const pet = s.app.windows().find((w) => w.url().endsWith("#companion"))!;
    await inputWindow.evaluate(() => window.buddy.setCardHidden(true));
    await expect(pet.locator(".companion-mini-clock")).toBeVisible();
    await expect(pet.locator(".companion-mini-clock")).toHaveText(
      /^\d{2}:\d{2}:\d{2}$/,
    );
    await pet.screenshot({ path: "test-results/compact-clock.png" });
    await inputWindow.evaluate(() => window.buddy.setCardHidden(false));
    await expect(pet.locator(".companion-mini-clock")).toHaveCount(0);
    await input.fill("长回复测试");
    await input.press("Enter");
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-reply")),
      )
      .toBe(true);
    const bubble = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-reply"))!;
    await expect(bubble.locator(".comic-wrap")).toHaveCSS("height", "135px");
    await expect(
      bubble.getByRole("navigation", { name: "回复分页" }),
    ).toBeVisible();
    await expect(bubble.locator(".comic-bubble")).toHaveAttribute(
      "data-status",
      "complete",
    );
    await expect
      .poll(() =>
        bubble
          .locator(".comic-wrap")
          .evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBeGreaterThan(270);
    await bubble.waitForTimeout(300);
    expect(
      await bubble
        .locator(".comic-bubble")
        .evaluate((el) => getComputedStyle(el).overflowY),
    ).toBe("hidden");
    let joined = "";
    for (let i = 0; i < 30; i++) {
      await expect
        .poll(() =>
          bubble
            .locator(".comic-bubble")
            .evaluate((el) => el.scrollHeight - el.clientHeight),
        )
        .toBeLessThanOrEqual(1);
      joined += await bubble.locator(".comic-text").textContent();
      const next = bubble.getByRole("button", { name: "下一页" });
      if (await next.isDisabled()) break;
      await next.click();
      await bubble.waitForTimeout(260);
    }
    expect(joined).toBe("你好" + text);
    await expect
      .poll(async () => {
        const native = await s.app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().endsWith("#desktop-reply"))!
              .getBounds().height,
        );
        const visible = await bubble
          .locator(".comic-wrap")
          .evaluate((el) => el.getBoundingClientRect().height);
        return Math.abs(native - visible);
      })
      .toBeLessThanOrEqual(1);
    await bubble.screenshot({ path: "test-results/paged-reply.png" });
  } finally {
    await s.cleanup();
    server.closeAllConnections();
    server.close();
    if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
    else process.env.BUDDY_CHAT_SERVICE = old;
  }
});
