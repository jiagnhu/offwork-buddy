import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("companion switches characters, collapses, scales and respects reduced motion", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-character-"));
  const app = await electron.launch({
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
  try {
    await expect.poll(() => app.windows().length).toBe(3);
    const page = app.windows().find((w) => w.url().includes("companion"))!;
    await expect(
      page.getByLabel("Haru Live2D 角色"),
    ).toBeVisible();
    await page.locator(".companion-stage").hover();
    await page.getByRole("button", { name: "切换伙伴" }).click();
    await expect(
      page.getByLabel("虹色 Mao Live2D 角色"),
    ).toBeVisible();
    await page.getByLabel("虹色 Mao Live2D 角色").click();
    await expect(page.locator(".speech-bubble")).toBeVisible();
    await page.locator(".companion-stage").hover();
    await page.getByRole("button", { name: "收起信息卡" }).click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith("#desktop-card"))!
            .isVisible(),
        ),
      )
      .toBe(false);
    await page.evaluate(() =>
      window.buddy.setPreferences({
        scale: 1.25,
        reducedMotion: true,
        collapsed: false,
        cardHidden: false,
      }),
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    expect(
      await page.evaluate(
        () =>
          document.body.getBoundingClientRect().bottom >=
          document.querySelector(".companion-root")!.getBoundingClientRect()
            .bottom,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/companion-assistant.png",
      omitBackground: true,
    });
    await page.evaluate(() =>
      window.buddy.setPreferences({ character: "haru" }),
    );
    await expect(
      page.getByLabel("Haru Live2D 角色"),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/companion-pet.png",
      omitBackground: true,
    });
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
