import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("fixed card stays put and concurrent plan actions preserve both updates", async () => {
  const { app, page, cleanup } = await launchDesktop((s) => {
    s.plans[s.startDate] = [
      { id: "a", text: "写报告", completed: false },
      { id: "b", text: "核对数据", completed: false },
    ];
  });
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    const card = app.windows().find((w) => w.url().endsWith("#desktop-card"))!;
    const before = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
        .getBounds(),
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#companion"))!
        .setPosition(100, 100),
    );
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
          .getBounds(),
      ),
    ).toEqual(before);
    await expect(card.getByRole("checkbox", { name: "写报告" })).toBeVisible();
    const today = await page.evaluate(
      async () => (await window.buddy.getSnapshot()).today,
    );
    await Promise.all([
      card.getByRole("checkbox", { name: "写报告" }).click(),
      page.evaluate(
        (d) =>
          window.buddy.updatePlan(d, {
            type: "complete",
            id: "b",
            completed: true,
          }),
        today,
      ),
    ]);
    await expect(card.getByText("今天的计划已完成")).toBeVisible();
    expect(
      await page.evaluate(
        async () => (await window.buddy.getSnapshot()).state.growth.points,
      ),
    ).toBe(4);
    await card.getByRole("button", { name: "展开今日计划" }).click();
    await expect(
      card.getByRole("checkbox", { name: "核对数据" }),
    ).toBeChecked();
    await page.evaluate(() => window.buddy.hideCompanion());
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .filter((w) => w.webContents.getURL().includes("#"))
          .every((w) => !w.isVisible()),
      ),
    ).toBe(true);
    await page.evaluate(() => window.buddy.showCompanion());
    await expect(card.locator(".floating-card")).toBeVisible();
  } finally {
    await cleanup();
  }
});

test("closing the card keeps it hidden when other preferences change", async () => {
  const { app, page, cleanup } = await launchDesktop();
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
        .close(),
    );
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.buddy.getSnapshot()).state.preferences.cardHidden,
        ),
      )
      .toBe(true);
    await page.evaluate(() => window.buddy.setPreferences({ theme: "dark" }));
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
          .isVisible(),
      ),
    ).toBe(false);
  } finally {
    await cleanup();
  }
});

test("the empty plan entry reopens today after closing the calendar dialog", async () => {
  const { app, page, cleanup } = await launchDesktop();
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    const card = app.windows().find((w) => w.url().endsWith("#desktop-card"))!;
    for (let i = 0; i < 2; i++) {
      await card.getByRole("button", { name: "添加今日计划" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "关闭", exact: true }).click();
    }
  } finally {
    await cleanup();
  }
});

test("orderly exit flushes the latest desktop position", async () => {
  const session = await launchDesktop();
  try {
    await expect.poll(() => session.app.windows().length).toBe(3);
    await session.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#companion"))!
        .setPosition(111, 222),
    );
    const { app, page } = await session.restart();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.buddy.getSnapshot()).state.preferences.position,
        ),
      )
      .toEqual({ x: 111, y: 222 });
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#companion"))!
          .getPosition(),
      ),
    ).toEqual([111, 222]);
  } finally {
    await session.cleanup();
  }
});
