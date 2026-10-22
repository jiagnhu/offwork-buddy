import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("high quality canvas follows display scale, while toolbar appears only on hover", async () => {
  const s = await launchDesktop((x) => {
    x.preferences.character = "haru";
    x.preferences.reducedMotion = true;
  });
  try {
    const p = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    await expect(p.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    const metrics = () =>
      p.locator("canvas").evaluate((el) => {
        const c = el as HTMLCanvasElement;
        return {
          width: c.width,
          height: c.height,
          rect: c.getBoundingClientRect().toJSON(),
          dpr: devicePixelRatio,
          aa: c.getContext("webgl")!.getContextAttributes()!.antialias,
        };
      });
    console.log("canvas baseline", await metrics());
    await p.screenshot({ path: "test-results/quality-character.png" });
    const m = await metrics();
    expect(m.width).toBeGreaterThanOrEqual(
      Math.floor(m.rect.width * m.dpr * 2),
    );
    for (const scale of [0.75, 1.25]) {
      await s.page.evaluate(
        (scale) => window.buddy.setPreferences({ scale }),
        scale,
      );
      await expect
        .poll(async () => {
          const a = await metrics();
          return Math.abs(a.width - Math.round(a.rect.width * a.dpr * 2));
        })
        .toBeLessThanOrEqual(1);
    }
    const client = await p.context().newCDPSession(p);
    await client.send("Emulation.setDeviceMetricsOverride", {width:450,height:625,deviceScaleFactor:1.5,mobile:false});
    await expect.poll(async () => (await metrics()).dpr).toBe(1.5);
    await expect.poll(async () => {
      const a = await metrics();
      return Math.abs(a.width - Math.round(a.rect.width * a.dpr * 2));
    }).toBeLessThanOrEqual(1);
    await client.send("Emulation.clearDeviceMetricsOverride");
    await p.mouse.move(-20, -20);
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "0");
    await p.locator("canvas").hover();
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "1");
    await p.getByRole("button", { name: "切换置顶" }).hover();
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "1");
    await p.getByRole("button", { name: "切换置顶" }).click();
    await p.mouse.move(-20, -20);
    await expect(p.locator(".companion-toolbar")).toHaveCSS("opacity", "0");
  } finally {
    await s.cleanup();
  }
});
