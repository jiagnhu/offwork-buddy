import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("drag handle remains interactive and moves the companion", async () => {
  const s = await launchDesktop((x) => {
    x.preferences.character = "haru";
  });
  try {
    const p = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    await p.locator("canvas").hover();
    const handle = p.locator(".companion-toolbar .drag-handle");
    await handle.hover();
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "1");
    // Native drag regions bypass DOM pointer events (including CSS hover).
    await expect(handle).toHaveCSS("-webkit-app-region", "no-drag");
    const win = await s.app.browserWindow(p);
    const before = await win.evaluate((w) => w.getBounds());
    const b = (await handle.boundingBox())!;
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(800);
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "1");
    await p.mouse.move(b.x + b.width / 2 - 70, b.y + b.height / 2 + 45, {
      steps: 3,
    });
    await p.mouse.up();
    await expect
      .poll(async () => (await win.evaluate((w) => w.getBounds())).x)
      .not.toBe(before.x);
    expect(await win.evaluate((w) => w.isVisible())).toBe(true);
    await expect
      .poll(
        async () =>
          (await s.page.evaluate(() => window.buddy.getSnapshot())).state
            .preferences.position?.x,
      )
      .toBe((await win.evaluate((w) => w.getBounds())).x);
    await p.mouse.move(-20, -20);
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "0");
    const savedBounds = await win.evaluate(w => w.getBounds());
    const restarted = await s.restart();
    const restored = restarted.app.windows().find(p => p.url().endsWith('#companion'))!;
    const restoredWindow = await restarted.app.browserWindow(restored);
    await expect.poll(async () => (await restoredWindow.evaluate(w=>w.getBounds())).x).toBe(savedBounds.x);
    await expect.poll(async () => (await restoredWindow.evaluate(w=>w.getBounds())).y).toBe(savedBounds.y);
  } finally {
    await s.cleanup();
  }
});
