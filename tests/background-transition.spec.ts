import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";

test("menu backgrounds blend over an opaque image and quick clicks settle on the latest page", async () => {
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect(
      s.page.locator('.app-scene img[data-scene="overview"]'),
    ).toBeVisible();
    await s.page.screenshot({ path: ".cache/scene-transition/before.png" });
    await s.page.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect
      .poll(() =>
        s.page
          .locator(".app-scene")
          .evaluate((el) => el.getAnimations({ subtree: true }).length),
      )
      .toBeGreaterThan(0);
    const blend = await s.page.locator(".app-scene").evaluate((el) => {
      const animation = el.getAnimations({ subtree: true })[0];
      animation.pause();
      animation.currentTime = 240;
      return Array.from(el.querySelectorAll("img")).map((img) => ({
        opacity: Number(getComputedStyle(img).opacity),
        loaded: img.complete && img.naturalWidth > 0,
      }));
    });
    expect(blend).toHaveLength(2);
    expect(blend.every((b) => b.loaded)).toBe(true);
    expect(blend[0].opacity).toBe(1);
    expect(blend[1].opacity).toBeGreaterThan(0.2);
    expect(blend[1].opacity).toBeLessThan(0.8);
    await s.page.screenshot({ path: ".cache/scene-transition/midpoint.png" });
    await s.page.evaluate(() => {
      for (const name of ["收入记录", "伙伴聊天", "偏好设置"])
        (
          Array.from(document.querySelectorAll("nav button")).find(
            (b) => b.textContent?.trim() === name,
          ) as HTMLButtonElement
        ).click();
      document
        .querySelector(".app-scene")!
        .getAnimations({ subtree: true })
        .forEach((a) => a.play());
    });
    await expect(s.page.locator(".sidebar button.active")).toHaveText(
      "偏好设置",
    );
    await expect(s.page.locator(".app-scene img")).toHaveCount(1);
    await expect(s.page.locator(".app-scene img")).toHaveAttribute(
      "data-scene",
      "settings",
    );
    await s.page.screenshot({ path: ".cache/scene-transition/after.png" });
  } finally {
    await s.cleanup();
  }
});

test("slow or failed image decoding never clears the old background or delays navigation", async () => {
  const s = await launchDesktop();
  try {
    await s.page.addInitScript(() => {
      const decode = HTMLImageElement.prototype.decode;
      const gate = new Promise<void>(
        (resolve) => ((window as any).releaseCalendar = resolve),
      );
      HTMLImageElement.prototype.decode = function () {
        if (this.src.includes("calendar-"))
          return gate.then(() => decode.call(this));
        if (this.src.includes("ledger-"))
          return Promise.reject(new Error("simulated decode failure"));
        return decode.call(this);
      };
    });
    await s.page.reload();
    await expect(
      s.page.locator('.app-scene img[data-scene="overview"]'),
    ).toBeVisible();
    await s.page.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "回到本月", exact: true }),
    ).toBeVisible();
    await expect(s.page.locator(".app-scene img")).toHaveCount(1);
    await expect(s.page.locator(".app-scene img")).toHaveAttribute(
      "data-scene",
      "overview",
    );
    await s.page.getByRole("button", { name: "收入记录", exact: true }).click();
    await s.page.evaluate(() => (window as any).releaseCalendar());
    await s.page.waitForTimeout(650);
    await expect(s.page.locator(".sidebar button.active")).toHaveText(
      "收入记录",
    );
    await expect(s.page.locator(".app-scene img")).toHaveAttribute(
      "data-scene",
      "overview",
    );
    await s.page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await expect(s.page.locator(".app-scene img")).toHaveCount(1);
    await expect(s.page.locator(".app-scene img")).toHaveAttribute(
      "data-scene",
      "settings",
    );
  } finally {
    await s.cleanup();
  }
});

test("reduced motion respects the app and OS preferences without leaving an unfinished blend", async () => {
  const s = await launchDesktop((state) => {
    state.preferences.reducedMotion = true;
  });
  try {
    await expect(
      s.page.locator('.app-scene img[data-scene="overview"]'),
    ).toBeVisible();
    for (const name of ["工作日历", "收入记录"]) {
      await s.page.getByRole("button", { name, exact: true }).click();
      await expect(s.page.locator(".app-scene img")).toHaveCount(1);
      await expect
        .poll(() => s.page.locator(".app-scene img").getAttribute("data-scene"))
        .toBe(name === "工作日历" ? "calendar" : "ledger");
      expect(
        await s.page
          .locator(".app-scene")
          .evaluate((el) => el.getAnimations({ subtree: true }).length),
      ).toBe(0);
    }
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ reducedMotion: false }),
    );
    await s.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    await s.page.emulateMedia({ reducedMotion: "reduce" });
    await expect(s.page.locator(".app-scene img")).toHaveCount(1);
    await expect(s.page.locator(".app-scene img")).toHaveAttribute(
      "data-scene",
      "chat",
    );
    expect(
      await s.page
        .locator(".app-scene")
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
    ).toBe(0);
  } finally {
    await s.cleanup();
  }
});
