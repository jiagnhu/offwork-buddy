import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("desktop windows isolate renderer and apply preferences", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-e2e-"));
  const app = await electron.launch({
    executablePath: process.env.BUDDY_EXECUTABLE,
    args: process.env.BUDDY_EXECUTABLE ? [] : ["."],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "ELECTRON_RUN_AS_NODE",
        ),
      ),
      BUDDY_DATA_DIR: data,
    },
  });
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    const page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await page.waitForLoadState("domcontentloaded");
    expect(await page.evaluate(() => typeof (window as any).require)).toBe(
      "undefined",
    );
    await expect
      .poll(() => page.evaluate(() => typeof window.buddy))
      .toBe("object");
    await page.evaluate(() =>
      window.buddy.setPreferences({ alwaysOnTop: false }),
    );
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("companion"))!
          .isAlwaysOnTop(),
      ),
    ).toBe(false);
    await app.evaluate(({ screen }) => screen.emit("display-metrics-changed"));
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("companion"))!
          .isAlwaysOnTop(),
      ),
    ).toBe(false);
    await page.evaluate(() =>
      window.buddy.setPreferences({ alwaysOnTop: true }),
    );
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("companion"))!
          .isAlwaysOnTop(),
      ),
    ).toBe(true);
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
