import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("onboarding, navigation, appearance and character survive restart", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-ui-"));
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key !== "ELECTRON_RUN_AS_NODE",
      ),
    ),
    BUDDY_DATA_DIR: data,
  };
  let app = await electron.launch({
    executablePath: process.env.BUDDY_EXECUTABLE,
    args: process.env.BUDDY_EXECUTABLE ? [] : ["."],
    env,
  });
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    let page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await expect(
      page.getByRole("heading", { name: /让每一秒，\s*都有回报。/ }),
    ).toBeVisible();
    await page.getByLabel("工资金额").fill("12000");
    await page.getByRole("button", { name: "开启我的桌面搭子" }).click();
    await expect(
      page.getByRole("heading", { name: "今天，也在慢慢变富。" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await page.getByLabel("午休开始").fill("08:00");
    await page.getByRole("button", { name: "保存工作设置" }).click();
    await expect(page.getByRole("alert")).toContainText("午休");
    await page.getByLabel("午休开始").fill("12:00");
    await page.getByRole("button", { name: "深色", exact: true }).click();
    await page.getByRole("button", { name: "预览 虹色 Mao",exact:true }).click();
    await page.getByRole("button", { name: "使用 虹色 Mao",exact:true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {timeout:30000});
    await page.screenshot({ path: "test-results/settings-dark.png" });
    await app.close();
    app = await electron.launch({
      executablePath: process.env.BUDDY_EXECUTABLE,
      args: process.env.BUDDY_EXECUTABLE ? [] : ["."],
      env,
    });
    await expect.poll(() => app.windows().length).toBe(3);
    page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {timeout:30000});
    expect(
      await page.evaluate(
        async () =>
          (await window.buddy.getSnapshot()).state.preferences.character,
      ),
    ).toBe("mao");
    await page.screenshot({ path: "test-results/overview-dark.png" });
    await page.evaluate(() => window.buddy.setPreferences({ theme: "light" }));
    await page.screenshot({ path: "test-results/overview-light.png" });
    const buddy = app.windows().find((w) => w.url().includes("companion"))!;
    await buddy.screenshot({ path: "test-results/companion.png" });
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
