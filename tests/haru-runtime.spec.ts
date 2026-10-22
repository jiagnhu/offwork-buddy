import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("real Haru renders, hides, restores and recovers after context loss", async () => {
  const s = await launchDesktop();
  try {
    const page = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ character: "haru" }),
    );
    await expect(page.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    await page.screenshot({ path: "test-results/haru-desktop.png" });
    expect(errors).toEqual([]);
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect(page.locator("canvas")).toHaveCount(0);
    await s.page.evaluate(() => window.buddy.showCompanion());
    await expect(page.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      {timeout: 30000},
    );
    await page.evaluate(() =>
      document
        .querySelector("canvas")!
        .getContext("webgl")!
        .getExtension("WEBGL_lose_context")!
        .loseContext(),
    );
    await expect(page.getByRole("alert")).toContainText("图形上下文");
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      {timeout: 30000},
    );
  } finally {
    await s.cleanup();
  }
});
