import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { countScheduledDays, resolveDay } from "../src/core/calendar";
test("income detail explains formula and preserves ledger", async () => {
  const { page, cleanup } = await launchDesktop((s) => {
    s.rules[0].mode = "monthly";
    s.rules[0].amount = "16000";
    s.rules[0].schedule = "alternating";
    s.rules[0].bigWeekMonday = "2026-10-19";
  });
  try {
    const { state, today } = await page.evaluate(() =>
      window.buddy.getSnapshot(),
    );
    const before = state.ledger;
    const rule = state.rules[0];
    const formula = resolveDay(today, rule, state.calendar, state.overrides)
      .workday
      ? `月薪 16000 元 ÷ ${countScheduledDays(today.slice(0, 7), rule)} 天`
      : "休息日不计预计收入";
    await page.getByRole("button", { name: "查看今日工资明细" }).click();
    await expect(
      page.getByRole("dialog", { name: "工资计算明细" }),
    ).toContainText(formula);
    await page.getByRole("button", { name: "关闭明细" }).click();
    expect(
      await page.evaluate(
        async () => (await window.buddy.getSnapshot()).state.ledger,
      ),
    ).toEqual(before);
  } finally {
    await cleanup();
  }
});

test("monthly rest-day detail never shows a null denominator", async () => {
  const { page, cleanup } = await launchDesktop((s) => {
    s.rules[0].mode = "monthly";
    s.overrides[s.startDate] = false;
  });
  try {
    await page.getByRole("button", { name: "查看今日工资明细" }).click();
    await expect(page.getByRole("dialog")).toContainText("休息日不计预计收入");
    await expect(page.getByRole("dialog")).not.toContainText("null");
  } finally {
    await cleanup();
  }
});
