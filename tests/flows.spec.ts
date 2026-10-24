import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rule } from "./fixtures";
test("calendar edits, dialog cancel, bad import and responsive layouts", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-flows-"));
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
    const page = app.windows().find((w) => w.url().endsWith("index.html"))!;
    await expect
      .poll(() => page.evaluate(() => typeof window.buddy))
      .toBe("object");
    await page.evaluate(
      (r) => window.buddy.saveSettings({ rule: r, startDate: "2026-10-01" }),
      rule,
    );
    await expect(
      page.getByRole("heading", { name: "今日概览", exact: true }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.buddy.setPreferences({ reducedMotion: true }),
    );
    for (const [width, height] of [
      [960, 720],
      [1280, 900],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, { width, height }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith("index.html"))!
            .setSize(width, height),
        { width, height },
      );
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate(
          (theme) => window.buddy.setPreferences({ theme }),
          theme,
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/overview-${width}-${theme}.png`,
        });
      }
    }
    await page.getByRole("button", { name: "工作日历", exact: true }).click();
    await page.locator(".day").filter({ hasText: /^10/ }).first().click();
    await page.getByRole("button", { name: "设为休息日" }).click();
    await expect.poll(async () =>
      (await page.evaluate(() => window.buddy.getSnapshot())).state.overrides[
        "2026-10-10"
      ]
    ).toBe(false);
    await page.screenshot({ path: "test-results/calendar.png" });
    const before = await page.evaluate(
      async () => (await window.buddy.getSnapshot()).state.ledger,
    );
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 0,
        checkboxChecked: false,
      });
    });
    await page.evaluate(() =>
      window.buddy.recalculate("2026-10-01", "2026-10-10"),
    );
    expect(
      (await page.evaluate(() => window.buddy.getSnapshot())).state.ledger,
    ).toEqual(before);
    const invalid = path.join(data, "invalid.json");
    await writeFile(invalid, '{"schemaVersion":99}');
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, invalid);
    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    await page.getByRole("button", { name: "导入", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(
      (await page.evaluate(() => window.buddy.getSnapshot())).state.ledger,
    ).toEqual(before);
    await page.getByRole("button", { name: "收入记录", exact: true }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.screenshot({ path: "test-results/ledger.png" });
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
