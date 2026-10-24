import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("character interaction uses a separate bubble and hover pauses its expiry", async () => {
  test.setTimeout(45000);
  const mock = await startMock();
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.interact());
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-reply")),
      )
      .toBe(true);
    const bubble = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-reply"))!;
    await expect(bubble.locator(".comic-text")).toContainText("魔法准备好啦");
    await expect(bubble.locator(".comic-wrap")).toHaveCSS("height", "100px");
    const pet = s.app.windows().find((w) => w.url().endsWith("#companion"))!;
    await expect(pet.locator(".speech-bubble")).toHaveCount(0);
    await bubble.locator(".comic-bubble").hover();
    await bubble.waitForTimeout(11000);
    const visible = () =>
      s.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#desktop-reply"))!
          .isVisible(),
      );
    expect(await visible()).toBe(true);
    await bubble.mouse.move(-20, -20);
    await expect.poll(visible, { timeout: 11000 }).toBe(false);
  } finally {
    await s.cleanup();
    mock.close();
  }
});

import { createServer } from "node:http";
import { once } from "node:events";
test("interaction received during AI reply is displayed afterwards", async () => {
  test.setTimeout(35000);
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      "data: " +
        JSON.stringify({
          type: "delta",
          text:
            JSON.parse(raw).purpose === "interaction"
              ? "魔法准备好啦"
              : "AI 回复",
        }) +
        '\n\ndata: {"type":"done"}\n\n',
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const old = process.env.BUDDY_CHAT_SERVICE;
  process.env.BUDDY_CHAT_SERVICE =
    "http://127.0.0.1:" + (server.address() as any).port;
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.openDesktopChat());
    await s.page.evaluate(() => window.buddy.sendChat("你好"));
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-reply")),
      )
      .toBe(true);
    const bubble = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-reply"))!;
    await expect(bubble.locator(".comic-text")).toContainText("AI 回复");
    await s.page.evaluate(() => window.buddy.interact());
    await expect(bubble.locator(".comic-text")).toContainText("AI 回复");
    await expect(bubble.locator(".comic-text")).toContainText("魔法准备好啦", {
      timeout: 12000,
    });
  } finally {
    await s.cleanup();
    server.closeAllConnections();
    server.close();
    if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
    else process.env.BUDDY_CHAT_SERVICE = old;
  }
});

async function startMock() {
  const old = process.env.BUDDY_CHAT_SERVICE;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      'data: {"type":"delta","text":"魔法准备好啦"}\n\ndata: {"type":"done"}\n\n',
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.BUDDY_CHAT_SERVICE =
    "http://127.0.0.1:" + (server.address() as any).port;
  return {
    close() {
      server.closeAllConnections();
      server.close();
      if (old === undefined) delete process.env.BUDDY_CHAT_SERVICE;
      else process.env.BUDDY_CHAT_SERVICE = old;
    },
  };
}

test("AI click reply waits for a plan notification and does not enter chat history", async () => {
  const mock = await startMock();
  const s = await launchDesktop();
  try {
    await s.page.evaluate(async () => {
      const now = new Date(),
        date = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
      await window.buddy.updatePlan(date, {
        type: "add",
        id: "ai-priority",
        text: "完成计划",
      });
      await window.buddy.updatePlan(date, {
        type: "complete",
        id: "ai-priority",
        completed: true,
      });
    });
    await expect
      .poll(() =>
        s.app.windows().some((w) => w.url().endsWith("#desktop-reply")),
      )
      .toBe(true);
    const bubble = s.app
      .windows()
      .find((w) => w.url().endsWith("#desktop-reply"))!;
    await expect(bubble.locator(".comic-text")).toContainText("又完成了一件事");
    await bubble.locator(".comic-bubble").hover();
    await s.page.evaluate(() => window.buddy.interact());
    await bubble.waitForTimeout(1000);
    await expect(bubble.locator(".comic-text")).toContainText("又完成了一件事");
    await bubble.mouse.move(-20, -20);
    await expect(bubble.locator(".comic-text")).toContainText("魔法准备好啦", {
      timeout: 12000,
    });
    const chat = await s.page.evaluate(() => window.buddy.getChat());
    expect(Object.values(chat.sessions).flat()).toHaveLength(0);
  } finally {
    await s.cleanup();
    mock.close();
  }
});
