import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("growth unlocks accessories at thresholds and shares progress between characters", async () => {
  const { app, page, cleanup } = await launchDesktop((s) => {
    s.growth.points = 9;
  });
  try {
    await page.getByRole("button", { name: "伙伴成长", exact: true }).click();
    await expect(page.getByRole("button", { name: "佩戴星星" })).toBeDisabled();
    await page.evaluate(() => window.buddy.interact());
    await expect(page.getByRole("button", { name: "佩戴星星" })).toBeEnabled();
    await page.getByRole("button", { name: "佩戴星星" }).click();
    await page.evaluate(() =>
      window.buddy.setPreferences({
        character: "assistant",
        reducedMotion: true,
      }),
    );
    expect(
      await page.evaluate(
        async () => (await window.buddy.getSnapshot()).state.growth.points,
      ),
    ).toBe(10);
    const character = app
      .windows()
      .find((w) => w.url().endsWith("#companion"))!;
    await expect(character.locator('[data-accessory="star"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "佩戴抱枕" })).toBeDisabled();
    await page.screenshot({ path: "test-results/growth.png" });
  } finally {
    await cleanup();
  }
});
test("pillow and celebration are available after sixty points", async () => {
  const { app, page, cleanup } = await launchDesktop((s) => {
    s.growth.points = 60;
    s.preferences.accessory = "pillow";
  });
  try {
    await page.getByRole("button", { name: "伙伴成长", exact: true }).click();
    await expect(page.getByText("特别庆祝已解锁")).toBeVisible();
    const character = app
      .windows()
      .find((w) => w.url().endsWith("#companion"))!;
    await expect(character.locator('[data-accessory="pillow"]')).toBeVisible();
    await character.screenshot({ path: "test-results/pillow.png" });
  } finally {
    await cleanup();
  }
});

test("selected pillow survives restart and poses fit both character windows", async () => {
  const session = await launchDesktop((s) => {
    s.growth.points = 30;
  });
  try {
    await session.page
      .getByRole("button", { name: "伙伴成长", exact: true })
      .click();
    await session.page.getByRole("button", { name: "佩戴抱枕" }).click();
    const { app, page } = await session.restart();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.buddy.getSnapshot()).state.preferences.accessory,
        ),
      )
      .toBe("pillow");
    const character = app
      .windows()
      .find((w) => w.url().endsWith("#companion"))!;
    for (const kind of ["pet", "assistant"] as const) {
      for (const scale of [0.75, 1.25]) {
        await page.evaluate(
          ({ kind, scale }) =>
            window.buddy.setPreferences({
              character: kind,
              scale,
              theme: "dark",
              reducedMotion: true,
            }),
          { kind, scale },
        );
        await expect(
          character.locator('[data-accessory="pillow"]'),
        ).toBeVisible();
        for (const pose of ["walk", "sit", "pillow"]) {
          await character
            .locator(".character-button")
            .evaluate((el, pose) => el.setAttribute("data-pose", pose), pose);
          await character.screenshot({
            path: "test-results/" + kind + "-" + scale + "-" + pose + ".png",
          });
        }
      }
    }
  } finally {
    await session.cleanup();
  }
});
