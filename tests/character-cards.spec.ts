import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";

test("read-only cards follow preview identity, load biographies on demand and preserve names", async () => {
  const s = await launchDesktop();
  const loreRequests: string[] = [];
  s.page.on("request", (request) => {
    if (request.url().includes("CharacterBiography-"))
      loreRequests.push(request.url());
  });
  try {
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
    await expect(s.page.getByRole("button", { name: /^预览 / })).toHaveCount(7);
    for (const [name, anchor] of [
      ["Rice", "决策者"],
      ["虹色 Mao", "策划者"],
      ["Miara", "长寿记录者"],
    ]) {
      await s.page
        .getByRole("button", { name: `预览 ${name}`, exact: true })
        .click();
      const modal = s.page.getByRole("dialog");
      await expect(modal.getByLabel("人物简介")).toContainText(anchor);
      await expect(modal.locator(".character-biography")).toHaveCount(0);
      await expect(modal.locator("input, textarea, select")).toHaveCount(0);
      await modal.getByRole("button", { name: "关闭预览" }).click();
    }
    expect(loreRequests).toHaveLength(0);
    await s.page
      .getByRole("button", { name: "预览 Rice", exact: true })
      .click();
    const modal = s.page.getByRole("dialog");
    await modal.locator("summary").filter({ hasText: "完整人物档案" }).click();
    await expect(modal.locator(".character-biography")).toContainText(
      "明确的秩序型反派",
    );
    await expect(modal.locator(".character-biography")).toContainText(
      "人生履历",
    );
    await expect(modal.locator(".character-biography")).not.toContainText(
      "稳定 ID",
    );
    await expect(modal.locator(".character-biography")).not.toContainText("**");
    await expect(modal.locator(".character-biography")).not.toContainText(
      "初始知识边界",
    );
    expect(loreRequests.length).toBeGreaterThan(0);
    await modal.getByRole("button", { name: "使用 Rice", exact: true }).click();
    await expect(
      s.page.getByRole("textbox", { name: "看板娘名称" }),
    ).toHaveValue("Rice");
    await s.page.getByRole("textbox", { name: "看板娘名称" }).fill("小书");
    await s.page.getByRole("button", { name: "保存名称", exact: true }).click();
    await s.page
      .getByRole("button", { name: "预览 小书", exact: true })
      .click();
    await expect(
      s.page.getByRole("dialog").getByLabel("人物简介"),
    ).toContainText("决策者");
    await expect(
      s.page.getByRole("dialog").locator(".haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    await s.page
      .getByRole("dialog")
      .locator("summary")
      .filter({ hasText: "完整人物档案" })
      .click();
    await expect(
      s.page.getByRole("dialog").locator(".character-biography"),
    ).toBeVisible();
    await s.page.screenshot({ path: "test-results/character-card.png" });
  } finally {
    await s.cleanup();
  }
});
