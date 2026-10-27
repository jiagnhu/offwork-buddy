import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("memory controls and a full personal story survive restart with a separate branch", async () => {
  test.setTimeout(120000);
  const s = await launchDesktop();
  try {
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await s.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    await s.page
      .getByRole("textbox", { name: "聊天内容", exact: true })
      .fill("记住我不喝咖啡");
    await s.page.getByRole("button", { name: "发送", exact: true }).click();
    await expect(s.page.getByText("已记下。", { exact: false })).toBeVisible();
    await s.page
      .getByRole("button", { name: "故事与记忆", exact: true })
      .click();
    const drawer = s.page.getByRole("dialog", { name: "故事与记忆" });
    await drawer.getByRole("button", { name: "记忆", exact: true }).click();
    await expect(drawer.getByText("我不喝咖啡", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "故事", exact: true }).click();
    await drawer
      .getByRole("button", { name: "开始 缺页的站务单", exact: true })
      .click();
    await drawer
      .getByRole("button", { name: "去旧桥核对编号", exact: true })
      .click();
    await drawer
      .getByRole("button", { name: "核对签收时间与完整附件", exact: true })
      .click();
    await drawer
      .getByRole("button", { name: "带着核对结果谈下一步", exact: true })
      .click();
    await drawer
      .getByRole("button", { name: "交出完整记录，接受站务审议", exact: true })
      .click();
    await expect(
      drawer.getByText("这一段故事已结束", { exact: true }),
    ).toBeVisible();
    await drawer.getByRole("button", { name: "存档", exact: true }).click();
    await drawer
      .getByRole("button", { name: "从这里尝试另一种选择" })
      .last()
      .click();
    await expect(drawer.getByText(/另一种选择/).first()).toBeVisible();
    await drawer.getByRole("button", { name: "关闭故事与记忆" }).click();
    const r = await s.restart();
    await r.page.getByRole("button", { name: "伙伴聊天", exact: true }).click();
    await r.page
      .getByRole("button", { name: "故事与记忆", exact: true })
      .click();
    await r.page.getByRole("button", { name: "记忆", exact: true }).click();
    await expect(r.page.getByText("我不喝咖啡", { exact: true })).toBeVisible();
    await r.page.screenshot({ path: "test-results/story-memory.png" });
  } finally {
    await s.cleanup();
  }
});
