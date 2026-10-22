import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rule } from "./fixtures";
async function launch() {
  const data = await mkdtemp(path.join(tmpdir(), "buddy-review-"));
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
  await expect.poll(() => app.windows().length).toBe(3);
  const page = app.windows().find((w) => w.url().endsWith("index.html"))!;
  await expect
    .poll(() => page.evaluate(() => typeof window.buddy))
    .toBe("object");
  return { app, page, data };
}
test("import refreshes visible work form", async () => {
  const { app, page, data } = await launch();
  try {
    await page.evaluate(
      (rule) => window.buddy.saveSettings({ rule, startDate: "2026-10-01" }),
      rule,
    );
    await page.getByRole("button", { name: "偏好设置", exact: true }).click();
    const imported = await page.evaluate(
      async () => (await window.buddy.getSnapshot()).state,
    );
    imported.rules.at(-1)!.amount = "777";
    const file = path.join(data, "import.json");
    await writeFile(file, JSON.stringify(imported));
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    }, file);
    await page.getByRole("button", { name: "导入", exact: true }).click();
    await expect(page.getByLabel("工资金额")).toHaveValue("777");
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
test("companion fits small work area without clipping", async () => {
  const { app, page, data } = await launch();
  try {
    await page.evaluate(
      (rule) => window.buddy.saveSettings({ rule, startDate: "2026-10-01" }),
      rule,
    );
    const buddy = app.windows().find((w) => w.url().endsWith("#desktop-card"))!;
    await page.evaluate(() => window.buddy.setPreferences({ scale: 1.25 }));
    await app.evaluate(({ screen }) => {
      const display = screen.getPrimaryDisplay();
      screen.getAllDisplays = () => [
        { ...display, workArea: { x: 0, y: 0, width: 450, height: 440 } },
      ];
      screen.emit("display-metrics-changed");
    });
    await expect.poll(() => buddy.evaluate(() => innerHeight)).toBe(440);
    await expect
      .poll(() =>
        buddy.evaluate(
          () =>
            document.querySelector(".floating-card")!.getBoundingClientRect()
              .bottom <= innerHeight,
        ),
      )
      .toBe(true);
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
test("failed header preference save is visible and keeps old preference", async () => {
  const { app, page, data } = await launch();
  try {
    await page.evaluate(
      (rule) => window.buddy.saveSettings({ rule, startDate: "2026-10-01" }),
      rule,
    );
    await expect(
      page.getByRole("heading", { name: "今天，也在慢慢变富。" }),
    ).toBeVisible();
    await mkdir(path.join(data, "state.tmp"));
    await page.getByRole("button", { name: "切换主题", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("保存");
    expect(
      (await page.evaluate(() => window.buddy.getSnapshot())).state.preferences
        .theme,
    ).toBe("light");
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
test("invalid schedule produces human-readable messages", async () => {
  const { app, page, data } = await launch();
  try {
    await page.getByLabel("工资金额").fill("800");
    await page.getByLabel("午休开始").fill("08:00");
    await page.getByRole("button", { name: "开启我的桌面搭子" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "午休须在工作时间内，且不能覆盖整个班次",
    );
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});
