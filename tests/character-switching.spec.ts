import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { characterOrder } from "../src/shared/characters";
test("twenty model switches release previous contexts and keep only one active canvas", async () => {
  test.setTimeout(180000);
  const s = await launchDesktop();
  try {
    const p = s.app.windows().find((p) => p.url().endsWith("#companion"))!;
    await p.addInitScript(() => {
      const contexts: WebGLRenderingContext[] = [];
      (window as any).__contexts = contexts;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: any[]
      ) {
        const gl = (original as any).apply(this, args);
        if (args[0] === "webgl" && gl && !contexts.includes(gl))
          contexts.push(gl);
        return gl;
      } as any;
    });
    await p.reload();
    for (let i = 0; i < 20; i++) {
      const kind = characterOrder[(i + 1) % characterOrder.length];
      await s.page.evaluate(
        (character) => window.buddy.setPreferences({ character }),
        kind,
      );
      await expect(p.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 30000 },
      );
      await expect(p.locator("canvas")).toHaveCount(1);
      await expect
        .poll(() =>
          p.evaluate(
            () =>
              (window as any).__contexts.filter(
                (gl: WebGLRenderingContext) => !gl.isContextLost(),
              ).length,
          ),
        )
        .toBe(1);
      await expect(p.getByRole("alert")).toHaveCount(0);
    }
    await s.page.evaluate(() => window.buddy.hideCompanion());
    await expect
      .poll(() =>
        p.evaluate(
          () =>
            (window as any).__contexts.filter(
              (gl: WebGLRenderingContext) => !gl.isContextLost(),
            ).length,
        ),
      )
      .toBe(0);
  } finally {
    await s.cleanup();
  }
});
