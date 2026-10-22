import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
test("offline resources remain silent; twenty switches release every old context", async () => {
  test.setTimeout(180000);
  const s = await launchDesktop();
  try {
    const page = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.addInitScript(() => {
      const state = {
        contexts: [] as WebGLRenderingContext[],
        pending: new Set<number>(),
        frames: 0,
      };
      (window as any).__haruProbe = state;
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
        const context = (get as any).apply(this, args);
        if (args[0] === "webgl" && context && !state.contexts.includes(context))
          state.contexts.push(context);
        return context;
      } as any;
      const request = window.requestAnimationFrame.bind(window),
        cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) => {
        const id = request((t) => {
          state.pending.delete(id);
          state.frames++;
          fn(t);
        });
        state.pending.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        state.pending.delete(id);
        cancel(id);
      };
    });
    await page.reload();
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    for (let i = 0; i < 20; i++) {
      await s.page.evaluate(() =>
        window.buddy.setPreferences({ character: "haru" }),
      );
      await expect(page.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 15000 },
      );
      await s.page.evaluate(() =>
        window.buddy.setPreferences({ character: "pet" }),
      );
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).__haruProbe.contexts.filter(
                (gl: WebGLRenderingContext) => !gl.isContextLost(),
              ).length,
          ),
        )
        .toBe(0);
      expect(
        await page.evaluate(() => (window as any).__haruProbe.pending.size),
      ).toBe(0);
    }
    await s.page.evaluate(() =>
      window.buddy.setPreferences({ character: "haru", reducedMotion: true }),
    );
    await expect(page.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
    );
    expect(
      await page.evaluate(() => (window as any).__haruProbe.pending.size),
    ).toBe(0);
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__haruProbe.contexts.filter(
              (gl: WebGLRenderingContext) => !gl.isContextLost(),
            ).length,
        ),
      )
      .toBe(0);
    expect(
      requests.filter((url) => /^https?:|\.(wav|mp3|ogg)(\?|$)/i.test(url)),
    ).toEqual([]);
  } finally {
    await s.cleanup();
  }
});
