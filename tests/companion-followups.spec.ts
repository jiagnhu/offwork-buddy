import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("name and rest interval persist; calendar shows paid holidays and saved amounts", async () => {
  const s = await launchDesktop((state) => {
    state.startDate = "2026-10-01";
    state.rules[0].official = true;
  });
  try {
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(s.page.locator('.character-current .haru-character')).toHaveAttribute('data-loaded','true',{timeout:30000});
    await expect(
      s.page.getByRole("textbox", { name: "看板娘名称" }),
    ).toHaveValue("Haru");
    await s.page.getByRole("textbox", { name: "看板娘名称" }).fill("小星");
    await s.page.getByRole("button", { name: "保存名称", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "预览 小星", exact: true }),
    ).toBeVisible();
    await s.page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await s.page.getByRole("switch", { name: "定时休息提醒" }).click();
    await expect(
      s.page.getByRole("switch", { name: "定时休息提醒" }),
    ).toBeChecked();
    await s.page
      .getByRole("spinbutton", { name: "休息提醒间隔（分钟）" })
      .fill("45");
    await s.page
      .getByRole("button", { name: "保存提醒间隔", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await s.page.evaluate(() => window.buddy.getSnapshot())).state
            .preferences.reminders.restMinutes,
      )
      .toBe(45);
    const restarted = await s.restart(),
      p = restarted.page;
    expect(
      (await p.evaluate(() => window.buddy.getSnapshot())).state.preferences
        .haruName,
    ).toBe("小星");
    expect(
      (await p.evaluate(() => window.buddy.getSnapshot())).state.preferences
        .reminders.restMinutes,
    ).toBe(45);
    await p.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "2026-10-01 国庆节", exact: true }),
    ).toContainText("¥800.00");
    await expect(
      p.getByRole("button", { name: "2026-10-04 休息日", exact: true }),
    ).toContainText("¥0.00");
    await expect(
      p.getByRole("button", { name: "2026-10-23 工作日", exact: true }),
    ).toContainText("预计 ¥800.00");
    await p.screenshot({ path: "test-results/followup-calendar.png" });
  } finally {
    await s.cleanup();
  }
});
test("periodic rest reaches the desktop bubble silently", async () => {
  const s = await launchDesktop((state) => {
    state.preferences.reminders.restMinutes = 45;
  });
  try {
    const buddy = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    await buddy.clock.setFixedTime(new Date("2026-10-22T09:45:00+08:00"));
    await s.app.evaluate(() => {
      const Real = Date;
      (globalThis as any).restClock = new Real(
        "2026-10-22T09:44:59+08:00",
      ).getTime();
      (globalThis as any).Date = class extends Real {
        constructor(value?: any) {
          super(value === undefined ? (globalThis as any).restClock : value);
        }
        static now() {
          return (globalThis as any).restClock;
        }
      };
    });
    await s.page.waitForTimeout(1200);
    await s.app.evaluate(() => {
      (globalThis as any).restClock += 1000;
    });
    await expect(buddy.locator(".speech-bubble")).toContainText("45 分钟");
    expect(await buddy.locator("audio,video").count()).toBe(0);
  } finally {
    await s.cleanup();
  }
});
