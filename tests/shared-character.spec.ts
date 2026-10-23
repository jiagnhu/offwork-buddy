import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";

test("overview and character space reuse a single loaded canvas", async () => {
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    const original = await s.page
      .locator(".overview-character canvas")
      .elementHandle();
    const reloads: string[] = [];
    s.page.on("request", (r) => {
      if (r.url().endsWith(".moc3")) reloads.push(r.url());
    });
    for (const menu of [
      "角色空间",
      "工作日历",
      "今日概览",
      "角色空间",
      "今日概览",
    ]) {
      await s.page.getByRole("button", { name: menu, exact: true }).click();
      if (menu === "工作日历") {
        await expect(s.page.locator(".calendar-grid")).toBeVisible();
      } else {
        const selector =
          menu === "角色空间" ? ".character-current" : ".overview-character";
        await expect(
          s.page.locator(`${selector} .haru-character`),
        ).toHaveAttribute("data-loaded", "true");
        expect(
          await s.page
            .locator(`${selector} canvas`)
            .evaluate((node, old) => node === old, original),
        ).toBe(true);
        await expect(s.page.locator(`${selector} canvas`)).toBeVisible();
        const size = await s.page.locator(`${selector} canvas`).boundingBox();
        expect(size!.width).toBeGreaterThan(100);
        expect(size!.height).toBeGreaterThan(100);
        if (menu === "今日概览") {
          const stage = await s.page
            .locator(".overview-character")
            .boundingBox();
          expect(size!.height).toBeLessThanOrEqual(stage!.height + 1);
        }
      }
      await expect(s.page.locator("canvas")).toHaveCount(1);
    }
    expect(reloads).toEqual([]);
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: "test-results/shared-overview.png" });
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(s.page.locator(".character-current canvas")).toBeVisible();
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: "test-results/shared-space.png" });
  } finally {
    await s.cleanup();
  }
});
