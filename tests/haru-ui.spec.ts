import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { mkdir,rm } from 'node:fs/promises';
import { join } from 'node:path';
test('failed character save leaves preview open and keeps the existing character',async()=>{
  const s=await launchDesktop();
  try {
    await s.page.getByRole('button',{name:'偏好设置',exact:true}).click();
    await s.page.getByRole('button',{name:'预览 丝袜妹'}).click();
    await mkdir(join(s.data,'state.tmp'));
    await s.page.getByRole('button',{name:'使用 丝袜妹',exact:true}).click();
    await expect(s.page.getByRole('dialog').getByRole('alert')).toBeVisible();
    expect((await s.page.evaluate(()=>window.buddy.getSnapshot())).state.preferences.character).toBe('pet');
    await rm(join(s.data,'state.tmp'),{recursive:true});
  }finally{await s.cleanup();}
});
test("preview tries all motions without rewards, explicit selection persists", async () => {
  test.setTimeout(120000);
  const s = await launchDesktop();
  try {
    await s.page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await s.page.getByRole("button", { name: "预览 丝袜妹" }).click();
    const dialog = s.page.getByRole("dialog");
    await expect(dialog.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    for (const label of [
      "待机 1",
      "待机 2",
      "互动 1",
      "互动 2",
      "互动 3",
      "互动 4",
      ...Array.from({ length: 8 }, (_, i) => `表情 ${i + 1}`),
    ]) {
      await dialog.getByRole("button", { name: label, exact: true }).click();
      await s.page.waitForTimeout(700);
      await dialog.screenshot({
        path: `test-results/haru-${label.replace(" ", "-")}.png`,
      });
    }
    const before = await s.page.evaluate(
      async () => (await window.buddy.getSnapshot()).state,
    );
    expect(before.preferences.character).toBe("pet");
    expect(before.growth.points).toBe(0);
    await dialog
      .getByRole("button", { name: "使用 丝袜妹", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const desktop = s.app
      .windows()
      .find((p) => p.url().endsWith("#companion"))!;
    await expect(desktop.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      {timeout: 30000},
    );
    await desktop.locator("canvas").hover();
    await expect(
      desktop.getByRole("button", { name: "当前模型暂无行走动作" }),
    ).toBeDisabled();
    await desktop.locator("canvas").click();
    await expect
      .poll(() =>
        s.page.evaluate(
          async () => (await window.buddy.getSnapshot()).state.growth.points,
        ),
      )
      .toBe(1);
    await desktop.locator("canvas").click();
    expect(
      (await s.page.evaluate(() => window.buddy.getSnapshot())).state.growth
        .points,
    ).toBe(1);
    const restarted = await s.restart();
    expect(
      (await restarted.page.evaluate(() => window.buddy.getSnapshot())).state
        .preferences.character,
    ).toBe("haru");
  } finally {
    await s.cleanup();
  }
});
