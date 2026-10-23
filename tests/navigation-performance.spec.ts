import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { readFile, writeFile } from "node:fs/promises";
test("menu switching stays responsive with monthly payroll and a live character", async () => {
  test.setTimeout(120000);
  const saved = process.env.BUDDY_PERF_STATE
    ? JSON.parse(await readFile(process.env.BUDDY_PERF_STATE, "utf8"))
    : null;
  const s = await launchDesktop((state) => {
    if (saved) {
      Object.assign(state, saved);
      return;
    }
    state.preferences.character = "hiyori";
    state.startDate = "2026-10-19";
    state.rules[0].mode = "monthly";
    state.rules[0].amount = "16000";
    state.rules[0].schedule = "alternating";
  });
  try {
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    const reloads: string[] = [];
    s.page.on("request", (r) => {
      if (r.url().endsWith(".moc3")) reloads.push(r.url());
    });
    const cdp = await s.page.context().newCDPSession(s.page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    const timings = await s.page.evaluate(async () => {
      const samples: { menu: string; ms: number }[] = [];
      for (const menu of [
        "工作日历",
        "收入记录",
        "工作日历",
        "偏好设置",
        "工作日历",
        "今日概览",
        "工作日历",
      ]) {
        const start = performance.now();
        const button = Array.from(document.querySelectorAll("nav button")).find(
          (b) => b.textContent?.trim() === menu,
        ) as HTMLButtonElement;
        button.click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        samples.push({ menu, ms: performance.now() - start });
      }
      return samples;
    });
    const { profile } = await cdp.send("Profiler.stop");
    await writeFile(
      "test-results/navigation-profile.json",
      JSON.stringify(profile),
    );
    console.log("NAVIGATION_TIMINGS", JSON.stringify(timings));
    await s.page.getByRole("button", { name: "今日概览", exact: true }).click();
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    expect(reloads).toEqual([]);
    expect(Math.max(...timings.map((t) => t.ms))).toBeLessThan(500);
    await s.page.getByRole("button", { name: "工作日历", exact: true }).click();
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "false");
    await s.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("index.html"))!
        .hide(),
    );
    await expect(s.page.locator(".overview-character canvas")).toHaveCount(0);
    await s.page.evaluate(() => window.buddy.openPanel());
    await expect(
      s.page.getByRole("button", { name: "回到本月", exact: true }),
    ).toBeVisible();
    await s.page.waitForTimeout(250);
    await expect(s.page.locator(".overview-character canvas")).toHaveCount(0);
    expect(reloads).toEqual([]);
    await s.page.getByRole("button", { name: "今日概览", exact: true }).click();
    await expect(
      s.page.locator(".overview-character .haru-character"),
    ).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
    expect(reloads).toHaveLength(1);
  } finally {
    await s.cleanup();
  }
});
