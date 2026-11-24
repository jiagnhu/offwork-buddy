import { test, expect } from "@playwright/test";
import { addDays, dateKey, weekday } from "../src/core/date";
import { saveJob } from "../src/core/jobs";
import { launchDesktop } from "./desktop-helper";
import { rule } from "./fixtures";

test("overview, ledger and desktop agree after switching the primary job", async () => {
  const today = dateKey(new Date());
  const monday = addDays(today, -7 - ((weekday(today) + 6) % 7));
  const session = await launchDesktop((state) => {
    state.startDate = monday;
    state.primaryJob.name = "主业";
    state.fxBook = { rates: { [monday]: 7.1 }, coverage: { [monday]: today } };
    Object.assign(
      state,
      saveJob(
        state,
        {
          name: "翻译兼职",
          currency: "USD",
          color: "#5f9ea0",
          startDate: monday,
          rule: {
            ...rule,
            mode: "biweekly",
            amount: "1000",
            periodStart: monday,
            payDate: addDays(monday, 15),
          },
        },
        new Date(),
      ),
    );
  });
  try {
    const page = session.page;
    await page.evaluate(() => window.buddy.hideCompanion());
    await expect(
      page.getByRole("heading", { name: "今日收入明细" }),
    ).toBeVisible();
    const before = await page.evaluate(
      async () => (await window.buddy.getSnapshot()).settledCents,
    );
    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await page.getByRole("button", { name: "翻译兼职", exact: true }).click();
    await page.getByRole("button", { name: "设为主要工作" }).click();
    await expect(
      page.getByRole("button", { name: "翻译兼职 · 主要" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        async () => (await window.buddy.getSnapshot()).settledCents,
      ),
    ).toBe(before);
    await page.getByRole("button", { name: "今日概览", exact: true }).click();
    await expect(page.locator(".countdown-hero")).toContainText("翻译兼职");
    await page.getByRole("button", { name: "收入记录", exact: true }).click();
    await page.getByLabel("查看月份").fill(monday.slice(0, 7));
    const ledgerRows = page.getByRole("row").filter({ hasText: monday });
    await expect(ledgerRows).toHaveCount(2);
    await page
      .getByLabel("筛选收入记录工作")
      .selectOption({ label: "翻译兼职" });
    await expect(ledgerRows).toHaveCount(1);
    await expect(ledgerRows).toContainText("¥710.00");
    await ledgerRows.getByRole("button", { name: /US\$100\.00/ }).click();
    await expect(page.getByRole("dialog")).toContainText(monday + " 中间价");
    await expect(page.getByRole("dialog")).toContainText("每两周 1000 美元");
    await page.getByRole("button", { name: "关闭明细" }).click();
    await page.evaluate(() => window.buddy.showCompanion());
    const card = session.app
      .windows()
      .find((win) => win.url().endsWith("#desktop-card"));
    expect(card).toBeDefined();
    await expect(card!.locator(".card-drag")).toContainText("翻译兼职");
    await expect(
      card!.getByRole("button", { name: "查看今日工资明细" }),
    ).toContainText("US$");
  } finally {
    await session.cleanup();
  }
});
