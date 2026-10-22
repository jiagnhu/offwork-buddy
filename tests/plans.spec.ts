import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rule } from "./fixtures";
test("daily plans can be completed, reopened and survive restart", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-plans-"));
  const launch = () =>
    electron.launch({
      executablePath: process.env.BUDDY_EXECUTABLE,
      args: process.env.BUDDY_EXECUTABLE ? [] : ["."],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([k]) => k !== "ELECTRON_RUN_AS_NODE",
          ),
        ),
        BUDDY_DATA_DIR: data,
      },
    });
  let app = await launch();
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    let page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await expect
      .poll(() => page.evaluate(() => typeof window.buddy))
      .toBe("object");
    const today = await page.evaluate(
      async () => (await window.buddy.getSnapshot()).today,
    );
    await page.evaluate(
      ({ rule, today }) =>
        window.buddy.saveSettings({ rule, startDate: today }),
      { rule, today },
    );
    await page.getByRole("button", { name: "工作日历", exact: true }).click();
    await page.locator(".day.today").click();
    await page
      .getByRole("textbox", { name: "新增工作计划" })
      .fill("完成本周报告");
    await page.getByRole("button", { name: "添加计划", exact: true }).click();
    const check = page.getByRole("checkbox", {
      name: "完成本周报告",
      exact: true,
    });
    await check.click();
    await expect(
      page.locator(".plan-text").filter({ hasText: "完成本周报告" }),
    ).toHaveCSS("text-decoration-line", "line-through");
    await check.click();
    await expect(
      page.locator(".plan-text").filter({ hasText: "完成本周报告" }),
    ).toHaveCSS("text-decoration-line", "none");
    await check.click();
    await expect(check).toBeChecked();
    await page.screenshot({ path: "test-results/daily-plans.png" });
    const companion = app
      .windows()
      .find((w) => w.url().endsWith("#desktop-card"))!;
    await expect(companion.locator(".floating-card")).not.toContainText(
      "累计预计",
    );
    await expect(companion.locator(".floating-card")).not.toContainText(
      "OFFWORK BUDDY",
    );
    await companion.screenshot({
      path: "test-results/companion-1.1.png",
      omitBackground: true,
    });
    await app.close();
    app = await launch();
    await expect.poll(() => app.windows().length).toBe(3);
    page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await page.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect(page.locator(".day.today")).toContainText("1/1");
    await page.locator(".day.today").click();
    await expect(
      page.getByRole("checkbox", { name: "完成本周报告", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "删除计划：完成本周报告", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "完成本周报告", exact: true }),
    ).toHaveCount(0);
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
