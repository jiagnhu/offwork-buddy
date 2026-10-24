import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("blue orange theme preserves six pages in both themes without horizontal overflow", async () => {
  test.setTimeout(120000);
  const s = await launchDesktop();
  try {
    await s.app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("index.html"),
      )!;
      w.setSize(1280, 900);
      w.show();
    });
    const pages = [
      "今日概览",
      "工作日历",
      "收入记录",
      "角色空间",
      "伙伴聊天",
      "偏好设置",
    ];
    for (const theme of ["dark", "light"] as const) {
      await s.page.evaluate(
        (t) => window.buddy.setPreferences({ theme: t }),
        theme,
      );
      for (const [i, name] of pages.entries()) {
        await s.page.getByRole("button", { name, exact: true }).click();
        await expect(s.page.locator(".page-skeleton")).toHaveCount(0);
        await expect(s.page.locator(".sidebar button.active")).toHaveText(name);
        await s.page.waitForTimeout(350);
        expect(
          await s.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await s.page.screenshot({
          path: `.cache/theme-preview/theme-${theme}-${i}.png`,
          fullPage: true,
        });
      }
    }
    await expect(
      s.page.getByRole("button", { name: "保存工作设置" }),
    ).toBeVisible();
    await s.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("index.html"))!
        .setSize(980, 760),
    );
    for (const name of pages) {
      await s.page.getByRole("button", { name, exact: true }).click();
      await s.page.waitForTimeout(250);
      expect(
        await s.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  } finally {
    await s.cleanup();
  }
});
