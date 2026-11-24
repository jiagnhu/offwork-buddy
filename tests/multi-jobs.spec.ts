import { test, expect } from "@playwright/test";
import { addDays, dateKey, weekday } from "../src/core/date";
import { launchDesktop } from "./desktop-helper";

test("creates a USD biweekly job and keeps leave, plans and payday receipt with that job", async () => {
  test.setTimeout(120000);
  const today = dateKey(new Date());
  const start = addDays(today, -14 - ((weekday(today) + 6) % 7));
  const session = await launchDesktop((state) => {
    state.startDate = start;
    state.rules[0].effectiveFrom = start;
    state.primaryJob.name = "本职工作";
    state.fxBook = { rates: { [start]: 7.1 }, coverage: { [start]: today } };
  });
  try {
    const page = session.page;
    await page.evaluate(() => window.buddy.hideCompanion());
    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await page.getByRole("button", { name: "添加工作", exact: true }).click();
    await page.getByLabel("工作名称", { exact: true }).fill("美元兼职");
    await page.getByLabel("累计开始日期").fill(start);
    await page.getByLabel("计薪方式").selectOption("biweekly");
    await page.getByLabel("计薪币种").selectOption("USD");
    await page.getByLabel("工资金额", { exact: true }).fill("1400");
    await page.getByLabel("计薪周期开始日").fill(start);
    await page.getByLabel("该期发薪日").fill(today);
    await expect(
      page.getByLabel("采用中国大陆节假日与调休安排"),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "创建工作", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "美元兼职", exact: true }),
    ).toBeVisible();

    await page.evaluate(
      (d) => window.buddy.openPanel({ page: "calendar", date: d }),
      start,
    );
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /美元兼职/ }).click();
    await expect(
      dialog.getByRole("button", { name: /美元兼职/ }),
    ).toContainText("US$140.00");
    await expect(
      dialog.getByRole("button", { name: /美元兼职/ }),
    ).toContainText("¥994.00");
    await expect(dialog.locator(".job-fx-note")).toContainText(start);
    await dialog.getByLabel("新增工作计划").fill("交付兼职报告");
    await dialog.getByRole("button", { name: "添加计划", exact: true }).click();
    await expect(
      dialog.getByRole("checkbox", { name: "交付兼职报告" }),
    ).toBeVisible();
    await dialog.getByLabel("请假开始时间").fill("09:00");
    await dialog.getByLabel("请假结束时间").fill("18:00");
    await dialog.getByRole("button", { name: "添加请假", exact: true }).click();
    await expect(dialog.locator(".leave-summary")).toContainText("US$140.00");
    await dialog.getByRole("button", { name: /本职工作/ }).click();
    await expect(dialog.locator(".leave-summary")).toHaveCount(0);
    await expect(
      dialog.getByRole("checkbox", { name: "交付兼职报告" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();

    await page.evaluate(
      (d) => window.buddy.openPanel({ page: "calendar", date: d }),
      today,
    );
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /美元兼职/ }).click();
    await expect(dialog.locator(".job-payout")).toContainText("US$1,260.00");
    await dialog
      .getByRole("button", { name: "标记已到账", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "撤销已到账", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await page.getByLabel("日历工作筛选").selectOption({ label: "美元兼职" });
    await expect(page.locator(".day.today")).toContainText("发薪日 · 已到账");

    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await page.getByRole("button", { name: "美元兼职", exact: true }).click();
    await page.getByRole("button", { name: "归档工作", exact: true }).click();
    await page.getByLabel("最后工作日").fill(addDays(today, -1));
    await page.getByRole("button", { name: "确认归档", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "美元兼职 · 已归档", exact: true }),
    ).toHaveAttribute("data-archived", "true");
    await page.evaluate(
      (d) => window.buddy.openPanel({ page: "calendar", date: d }),
      today,
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "关闭", exact: true })
      .click();
    await page.getByLabel("日历工作筛选").selectOption({ label: "美元兼职" });
    await expect(page.locator(".day.today")).toContainText("发薪日 · 已到账");
    await expect(page.locator(".day.today")).toContainText("已结束");
  } finally {
    await session.cleanup();
  }
});
