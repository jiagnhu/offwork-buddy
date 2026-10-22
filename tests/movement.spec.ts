import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("saving a drag does not reset native size or z-order; showing rescues an offscreen window", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-move-"));
  const app = await electron.launch({
    executablePath: process.env.BUDDY_EXECUTABLE,
    args: process.env.BUDDY_EXECUTABLE ? [] : ["."],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([k]) => k !== "ELECTRON_RUN_AS_NODE",
        ),
      ),
      BUDDY_DATA_DIR: dir,
    },
  });
  try {
    await expect.poll(() => app.windows().length).toBe(2);
    const page = app.windows().find((w) => !w.url().includes("companion"))!;
    await expect
      .poll(() => page.evaluate(() => typeof window.buddy))
      .toBe("object");
    const position = await app.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("companion"),
      )!;
      const a = screen.getPrimaryDisplay().workArea;
      w.setPosition(a.x + 100, a.y + 100);
      const probe = { size: 0, top: 0 };
      (globalThis as any).movementProbe = probe;
      const size = w.setBounds.bind(w),
        top = w.setAlwaysOnTop.bind(w);
      w.setBounds = (...args) => {
        probe.size++;
        return size(...args);
      };
      w.setAlwaysOnTop = (...args) => {
        probe.top++;
        return top(...args);
      };
      w.emit("moved");
      return { x: a.x + 100, y: a.y + 100 };
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.buddy.getSnapshot()).state.preferences.position,
        ),
      )
      .toEqual(position);
    expect(await app.evaluate(() => (globalThis as any).movementProbe)).toEqual(
      { size: 0, top: 0 },
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("companion"),
      )!;
      w.hide();
      w.setPosition(-30000, -30000);
    });
    await page.evaluate(() => window.buddy.showCompanion());
    expect(
      await app.evaluate(({ BrowserWindow, screen }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("companion"),
        )!;
        const b = w.getBounds();
        return (
          w.isVisible() &&
          screen.getAllDisplays().some((d) => {
            const a = d.workArea;
            return (
              b.x >= a.x &&
              b.y >= a.y &&
              b.x + b.width <= a.x + a.width &&
              b.y + b.height <= a.y + a.height
            );
          })
        );
      }),
    ).toBe(true);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
