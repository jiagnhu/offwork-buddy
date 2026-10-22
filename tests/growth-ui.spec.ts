import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("growth rewards are shared by the Live2D library and legacy accessories stay recorded", async () => {
  const s = await launchDesktop((x) => {
    x.growth.points = 30;
    x.preferences.accessory = "pillow";
  });
  try {
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(
      s.page.getByRole("button", { name: "佩戴抱枕" }),
    ).toHaveCount(0);
    await s.page.evaluate(() => window.buddy.interact());
    for (const character of ["mao", "hiyori", "miara", "rice"] as const) {
      await s.page.evaluate(
        (character) => window.buddy.setPreferences({ character }),
        character,
      );
      const state = (await s.page.evaluate(() => window.buddy.getSnapshot()))
        .state;
      expect(state.growth.points).toBe(31);
      expect(state.preferences.accessory).toBe("pillow");
    }
    const { page } = await s.restart();
    const state = (await page.evaluate(() => window.buddy.getSnapshot())).state;
    expect(state.growth.points).toBe(31);
    expect(state.preferences.accessory).toBe("pillow");
  } finally {
    await s.cleanup();
  }
});
