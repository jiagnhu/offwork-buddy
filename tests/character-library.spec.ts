import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { characterOrder, live2dModels } from "../src/shared/characters";
test("all characters preview, animate, select and load offline", async () => {
  test.setTimeout(240000);
  const s = await launchDesktop();
  try {
    const desktop = s.app
      .windows()
      .find((p) => p.url().endsWith("#companion"))!;
    const errors: string[] = [];
    desktop.on("pageerror", (e) => errors.push(e.message));
    s.page.on("pageerror", (e) => errors.push(e.message));
    const requests: string[] = [];
    desktop.on("request", (r) => requests.push(r.url()));
    const cdp = await desktop.context().newCDPSession(desktop);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(s.page.getByText("萌宠 · 年糕")).toHaveCount(0);
    await expect(s.page.getByText("看板娘 · 小沐")).toHaveCount(0);
    for (const kind of characterOrder) {
      const model = live2dModels[kind];
      await s.page
        .getByRole("button", { name: `预览 ${model.name}`, exact: true })
        .click();
      const dialog = s.page.getByRole("dialog");
      await expect(dialog.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 30000 },
      );
      await expect(
        dialog.getByRole("button", { name: /^表情 \d/ }),
      ).toHaveCount(model.expressions.length);
      for (const prefix of ["待机", "互动", "表情"]) {
        const count =
          prefix === "待机"
            ? model.idle
            : prefix === "互动"
              ? model.tap
              : model.expressions.length;
        for (let i = 1; i <= count; i++) {
          await dialog
            .getByRole("button", { name: prefix + " " + i, exact: true })
            .click();
          await s.page.waitForTimeout(100);
          await expect(dialog.getByRole("alert")).toHaveCount(0);
        }
      }
      await s.page.waitForTimeout(900);
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await dialog
        .getByRole("button", { name: `使用 ${model.name}`, exact: true })
        .click();
      await expect(
        desktop.getByLabel(`${model.name} Live2D 角色`),
      ).toBeVisible();
      await expect(desktop.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 30000 },
      );
      await desktop.waitForTimeout(1200);
      await desktop.screenshot({ path: `test-results/library-${kind}.png` });
      await expect(desktop.getByRole("alert")).toHaveCount(0);
      expect(
        (await s.page.evaluate(() => window.buddy.getSnapshot())).state
          .preferences.character,
      ).toBe(kind);
    }
    expect(errors).toEqual([]);
    expect(
      requests.filter((u) => /^https?:|\.(wav|mp3|ogg)(\?|$)/i.test(u)),
    ).toEqual([]);
    const restarted = await s.restart();
    await expect
      .poll(
        async () =>
          (await restarted.page.evaluate(() => window.buddy.getSnapshot()))
            .state.preferences.character,
      )
      .toBe(characterOrder.at(-1));
  } finally {
    await s.cleanup();
  }
});
