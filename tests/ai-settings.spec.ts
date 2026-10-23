import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { launchDesktop } from "./desktop-helper";
test("AI settings are build gated and developer credentials persist without plaintext", async () => {
  test.setTimeout(90000);
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await s.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    const dev = process.env.BUDDY_TEST_DEVELOPER === "1";
    expect(
      (await s.page.evaluate(() => window.buddy.getAISettings())).enabled,
    ).toBe(dev);
    if (!dev) {
      await expect(
        s.page.getByRole("button", { name: "AI 服务设置", exact: true }),
      ).toHaveCount(0);
      expect(
        await s.page.evaluate(async () => {
          try {
            await window.buddy.saveAISettings({
              key: "dummy",
              baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              model: "test",
            });
            return "";
          } catch (e) {
            return String(e);
          }
        }),
      ).toContain("开发版");
      return;
    }
    await s.page
      .getByRole("button", { name: "AI 服务设置", exact: true })
      .click();
    const dialog = s.page.getByRole("dialog", { name: "AI 服务设置" });
    const secret = "test-credential-no-network-173";
    await dialog.getByLabel("百炼 API Key", { exact: true }).fill(secret);
    await dialog.getByLabel("百炼模型标识").fill("test-model");
    await dialog.getByRole("button", { name: "保存并启用" }).click();
    await expect(dialog.getByRole("status")).toContainText("已加密保存");
    await expect(
      dialog.getByLabel("百炼 API Key", { exact: true }),
    ).toHaveValue("");
    expect(
      await readFile(path.join(s.data, "ai-settings.json"), "utf8"),
    ).not.toContain(secret);
    expect(
      JSON.stringify(await s.page.evaluate(() => window.buddy.getAISettings())),
    ).not.toContain(secret);
    await s.page.screenshot({ path: "test-results/ai-settings.png" });
    const r = await s.restart();
    const config = await r.page.evaluate(() => window.buddy.getAISettings());
    expect(config).toMatchObject({
      hasKey: true,
      running: true,
      model: "test-model",
    });
  } finally {
    await s.cleanup();
  }
});
