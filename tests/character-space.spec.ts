import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";

test("character space replaces growth, selects models and keeps historical data", async () => {
  const s = await launchDesktop((x) => {
    x.growth.points = 30;
    x.preferences.accessory = "pillow";
  });
  try {
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "伙伴成长", exact: true }),
    ).toHaveCount(0);
    await expect(s.page.getByRole("button", { name: /^预览 / })).toHaveCount(7);
    await expect(s.page.locator(".character-choice img")).toHaveCount(7);
    await expect
      .poll(() =>
        s.page
          .locator(".character-choice img")
          .evaluateAll((images) =>
            images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
          ),
        { timeout: 30000 },
      )
      .toBe(true);
    await expect(
      s.page.getByRole("progressbar", { name: "成长进度" }),
    ).toHaveCount(0);
    await expect(
      s.page.getByRole("button", { name: /佩戴|取下配饰/ }),
    ).toHaveCount(0);
    await expect(
      s.page.getByRole("heading", { name: "Haru", exact: true }),
    ).toBeVisible();
    await s.page.getByRole("textbox", { name: "看板娘名称" }).fill("小星");
    await s.page.getByRole("button", { name: "保存名称", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "预览 小星", exact: true }),
    ).toBeVisible();
    await s.page
      .getByRole("button", { name: "预览 Rice", exact: true })
      .click();
    const dialog = s.page.getByRole("dialog");
    await expect(dialog.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    await dialog
      .getByRole("button", { name: "使用 Rice", exact: true })
      .click();
    await expect(
      s.page.getByRole("heading", { name: "Rice", exact: true }),
    ).toBeVisible();
    await expect(
      s.page.locator('.character-choice[aria-pressed="true"]'),
    ).toContainText("Rice");
    await expect(
      s.page.locator(".character-current .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    await s.page.evaluate(() => window.scrollTo(0, 0));
    await s.page.screenshot({
      path: "test-results/character-space-light.png",
      fullPage: true,
    });
    await s.page.getByRole("button", { name: "切换主题", exact: true }).click();
    await expect(s.page.locator("html")).toHaveAttribute("data-theme", "dark");
    await s.page.waitForTimeout(350);
    await s.page.screenshot({
      path: "test-results/character-space-dark.png",
      fullPage: true,
    });
    await s.page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await expect(s.page.getByRole("button", { name: /^预览 / })).toHaveCount(0);
    await expect(s.page.getByText("查看成长与配饰")).toHaveCount(0);
    await expect(s.page.getByRole("heading", { name: "伙伴成长" })).toHaveCount(
      0,
    );
    await expect(
      s.page.getByRole("switch", { name: "定时休息提醒" }),
    ).toBeVisible();
    const r = await s.restart();
    const state = (await r.page.evaluate(() => window.buddy.getSnapshot()))
      .state;
    expect(state.preferences.character).toBe("rice");
    expect(state.preferences.haruName).toBe("小星");
    expect(state.growth.points).toBe(30);
    expect(state.preferences.accessory).toBe("pillow");
  } finally {
    await s.cleanup();
  }
});

test("every character has an independent nickname across UI, desktop and restart", async () => {
  test.setTimeout(120000);
  const s = await launchDesktop();
  try {
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    const desktop = s.app
      .windows()
      .find((w) => w.url().endsWith("#companion"))!;
    for (const [original, nickname] of [
      ["Haru", "小晴"],
      ["虹色 Mao", "小猫"],
      ["桃濑日和", "日和酱"],
      ["Miara", "精灵"],
      ["Tororo", "白白"],
      ["Hijiki", "黑黑"],
      ["Rice", "书书"],
    ]) {
      await s.page
        .getByRole("button", { name: `预览 ${original}`, exact: true })
        .click();
      await s.page
        .getByRole("dialog")
        .getByRole("button", { name: `使用 ${original}`, exact: true })
        .click();
      await s.page.getByRole("textbox", { name: "看板娘名称" }).fill(nickname);
      await s.page
        .getByRole("button", { name: "保存名称", exact: true })
        .click();
      await expect(
        s.page.getByRole("heading", { name: nickname, exact: true }),
      ).toBeVisible();
      await expect(desktop.getByLabel(`${nickname} Live2D 角色`)).toBeVisible({
        timeout: 30000,
      });
    }
    await s.page.getByRole("button", { name: "今日概览", exact: true }).click();
    await expect(s.page.getByRole("heading", { name: /^书书/ })).toBeVisible();
    await expect(s.page.locator('.overview-character .haru-character')).toHaveAttribute('data-loaded','true',{timeout:30000});
    await expect(s.page.locator('.overview-character').getByLabel('书书 Live2D 角色')).toBeVisible();
    const r = await s.restart();
    const p = (await r.page.evaluate(() => window.buddy.getSnapshot())).state
      .preferences;
    expect(p.haruName).toBe("小晴");
    expect(p.characterNames).toEqual({
      mao: "小猫",
      hiyori: "日和酱",
      miara: "精灵",
      tororo: "白白",
      hijiki: "黑黑",
      rice: "书书",
    });
    await r.page.getByRole("button", { name: "角色空间", exact: true }).click();
    for (const nickname of ["小晴", "小猫", "日和酱", "精灵", "白白", "黑黑", "书书"])
      await expect(
        r.page.getByRole("button", { name: `预览 ${nickname}`, exact: true }),
      ).toBeVisible();
  } finally {
    await s.cleanup();
  }
});
