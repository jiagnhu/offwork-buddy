import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { launchDesktop } from "./desktop-helper";
import { addDays, dateKey } from "../src/core/date";
test("v1 upgrade preserves historic money and blocks retroactive plan rewards across restart", async () => {
  const today = dateKey(new Date()),
    yesterday = addDays(today, -1);
  const session = await launchDesktop((state) => {
    const s = state as any;
    s.startDate = yesterday;
    s.schemaVersion = 1;
    delete s.growth;
    delete s.reminderHistory;
    s.ledger[yesterday] = {
      date: yesterday,
      ruleId: s.rules[0].id,
      rule: { ...s.rules[0] },
      amountCents: 84211,
      workday: true,
      workdayCount: 19,
      calendarSnapshot: {
        workday: true,
        source: "schedule",
        calendarMissing: false,
      },
    };
    s.plans[today] = [
      { id: "old", text: "升级前已完成", completed: true },
      { id: "new", text: "今天还要做", completed: false },
    ];
  });
  try {
    expect(
      JSON.parse(
        await readFile(path.join(session.data, "state.pre-v2.json"), "utf8"),
      ).schemaVersion,
    ).toBe(1);
    const before = await session.page.evaluate(
      async () => (await window.buddy.getSnapshot()).state,
    );
    expect(before.ledger[yesterday].amountCents).toBe(84211);
    expect(before.growth.points).toBe(0);
    await session.page.evaluate(async (d) => {
      await window.buddy.updatePlan(d, {
        type: "complete",
        id: "old",
        completed: false,
      });
      await window.buddy.updatePlan(d, {
        type: "complete",
        id: "old",
        completed: true,
      });
      await window.buddy.updatePlan(d, {
        type: "complete",
        id: "new",
        completed: true,
      });
    }, today);
    const { page } = await session.restart();
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.buddy.getSnapshot()).state.growth.points,
        ),
      )
      .toBe(2);
    expect(
      await page.evaluate(
        async (d) =>
          (await window.buddy.getSnapshot()).state.ledger[d].amountCents,
        yesterday,
      ),
    ).toBe(84211);
    await page.evaluate(
      (d) => window.buddy.openPanel({ page: "earnings", date: d }),
      yesterday,
    );
    await expect(page.getByRole("dialog")).toContainText("842.11");
  } finally {
    await session.cleanup();
  }
});
