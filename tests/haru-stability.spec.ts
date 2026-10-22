import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("Haru stays selected on one canvas for a full minute without automatic replacement", async () => {
  test.setTimeout(100000);
  const s = await launchDesktop((state) => {
    state.preferences.character = "haru";
  });
  try {
    const desktop = s.app
      .windows()
      .find((p) => p.url().endsWith("#companion"))!;
    await s.app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (w.webContents.getURL().includes("#")) w.setIgnoreMouseEvents(true);
        else w.hide();
      }
    });
    await expect(desktop.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    await desktop
      .locator("canvas")
      .evaluate((canvas) => (canvas.dataset.lifetime = "original"));
    for (let i = 0; i < 20; i++) {
      await desktop.waitForTimeout(3000);
      await expect(desktop.locator("canvas")).toHaveAttribute(
        "data-lifetime",
        "original",
      );
      await expect(desktop.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
      );
      expect(
        (await desktop.evaluate(() => window.buddy.getSnapshot())).state
          .preferences.character,
      ).toBe("haru");
    }
    await desktop.screenshot({ path: "test-results/haru-stable-desktop.png" });
  } finally {
    await s.cleanup();
  }
});
