import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test('first-run setup still loads its shared salary form',async()=>{
  const s=await launchDesktop(state=>{state.configured=false;});
  try {await expect(s.page.getByRole('heading',{name:'先认识一下你的工作日'})).toBeVisible();await expect(s.page.locator('.onboard-form form')).toBeVisible();}
  finally {await s.cleanup();}
});
test("navigation paints a loading shell first and fast clicks show only the latest page", async () => {
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    // Measure navigation after startup has finished loading its initial model.
    // First model initialization is a separate cost from repeated page switches.
    await expect(s.page.locator('.overview-character .haru-character')).toHaveAttribute('data-loaded', 'true', {timeout:30000});
    const firstFrame = await s.page.evaluate(async () => {
      (
        Array.from(document.querySelectorAll("nav button")).find(
          (b) => b.textContent?.trim() === "工作日历",
        ) as HTMLButtonElement
      ).click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return {
        active: document
          .querySelector('nav [aria-current="page"]')
          ?.textContent?.trim(),
        loading: !!document.querySelector('[aria-label="正在加载页面"]'),
        calendar: !!document.querySelector(".calendar-grid"),
      };
    });
    expect(firstFrame).toEqual({
      active: "工作日历",
      loading: true,
      calendar: false,
    });
    await expect(s.page.locator(".calendar-grid")).toBeVisible();
    await s.page.evaluate(async () => {
      for (const label of ["角色空间", "收入记录", "偏好设置"]) {
        (
          Array.from(document.querySelectorAll("nav button")).find(
            (b) => b.textContent?.trim() === label,
          ) as HTMLButtonElement
        ).click();
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      }
    });
    await expect(
      s.page.getByRole("switch", { name: "定时休息提醒" }),
    ).toBeVisible();
    await expect(
      s.page.getByRole("status", { name: "正在加载页面" }),
    ).toHaveCount(0);
    await expect(s.page.locator(".character-space")).toHaveCount(0);
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(s.page.locator(".character-current")).toBeVisible();
    await expect(s.page.locator('.character-current .haru-character')).toHaveAttribute('data-loaded','true',{timeout:30000});
    await s.page.evaluate(() => window.scrollTo(0, 400));
    const before = await s.page.locator(".character-current").boundingBox();
    await s.page.evaluate(() => window.scrollBy(0, 200));
    const after = await s.page.locator(".character-current").boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
    expect(after!.y).toBeGreaterThanOrEqual(20);
    await s.page.screenshot({ path: "test-results/sticky-character.png" });
    await s.page.setViewportSize({ width: 800, height: 700 });
    await expect(s.page.locator(".character-current")).toHaveCSS(
      "position",
      "static",
    );
  } finally {
    await s.cleanup();
  }
});
