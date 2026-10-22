import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { launchDesktop } from "./desktop-helper";
test("autonomous walking leaves the fixed card and saved position unchanged; reduced motion stops it", async () => {
  const { app, page, data, cleanup } = await launchDesktop((s) => {
    s.preferences.position = { x: 500, y: 718 };
    s.preferences.cardPosition = { x: 1100, y: 100 };
    s.preferences.movementMode = "bottom";
    s.preferences.reducedMotion = false;
  });
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    await app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows())
        if (w.webContents.getURL().includes("#")) w.setIgnoreMouseEvents(true);
    });
    const card = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
        .getBounds(),
    );
    await new Promise((r) => setTimeout(r, 600));
    const saved = await readFile(path.join(data, "state.json"), "utf8");
    await app.evaluate(({ screen }) => {
      screen.getCursorScreenPoint = () => ({ x: -30000, y: -30000 });
      const realNow = Date.now.bind(Date),
        start = realNow();
      Date.now = () => start + (realNow() - start) * 5;
      Math.random = () => 0.5;
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            async () => (await window.buddy.getSnapshot()).behavior.phase,
          ),
        { timeout: 20000 },
      )
      .toBe("walking");
    await expect
      .poll(() =>
        app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().endsWith("#companion"))!
              .getBounds().x,
        ),
      )
      .not.toBe(500);
    expect(await readFile(path.join(data, "state.json"), "utf8")).toBe(saved);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
          .getBounds(),
      ),
    ).toEqual(card);
    await page.evaluate(() =>
      window.buddy.setPreferences({ reducedMotion: true }),
    );
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.buddy.getSnapshot()).behavior.phase,
        ),
      )
      .toBe("paused");
    const position = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#companion"))!
        .getBounds(),
    );
    await new Promise((r) => setTimeout(r, 400));
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#companion"))!
          .getBounds(),
      ),
    ).toEqual(position);
  } finally {
    await cleanup();
  }
});

test("after descending beside the card the character completes multiple roaming cycles", async () => {
  const { app, page, cleanup } = await launchDesktop((s) => {
    s.preferences.scale = 1.2;
    s.preferences.position = { x: 500, y: 100 };
    s.preferences.cardPosition = { x: 944, y: 250 };
    s.preferences.movementMode = "bottom";
    s.preferences.reducedMotion = false;
  });
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    await app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows())
        if (w.webContents.getURL().includes("#")) w.setIgnoreMouseEvents(true);
    });
    await app.evaluate(({ screen }) => {
      screen.getCursorScreenPoint = () => ({ x: -30000, y: -30000 });
      const realNow = Date.now.bind(Date),
        start = realNow();
      Date.now = () => start + (realNow() - start) * 5;
      Math.random = () => 0.5;
    });
    const bounds = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("#companion"))!
          .getBounds(),
      );
    const phase = () =>
      page.evaluate(
        async () => (await window.buddy.getSnapshot()).behavior.phase,
      );
    await expect
      .poll(async () => (await bounds()).y, { timeout: 25000 })
      .toBe(656);
    await expect.poll(phase).not.toBe("walking");
    const positions = [(await bounds()).x];
    for (let cycle = 0; cycle < 2; cycle++) {
      await expect.poll(phase, { timeout: 12000 }).toBe("walking");
      await expect.poll(phase, { timeout: 8000 }).not.toBe("walking");
      positions.push((await bounds()).x);
    }
    expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(80);
    expect(
      await app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
            .getBounds().x,
      ),
    ).toBe(944);
  } finally {
    await cleanup();
  }
});
