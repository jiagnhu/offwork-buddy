// Run after npm run build. Captures the bundled models, never the user's data.
import { _electron as electron, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const compiled = await build({
  entryPoints: ["tests/fixtures.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { fixture } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
const inventory = JSON.parse(
  await readFile("src/shared/character-inventory.json", "utf8"),
);
const data = await mkdtemp(path.join(tmpdir(), "buddy-portraits-"));
const output = path.resolve("src/renderer/assets/characters");
await mkdir(output, { recursive: true });
const state = fixture();
state.preferences.character = "haru";
state.preferences.reducedMotion = true;
await writeFile(path.join(data, "state.json"), JSON.stringify(state));
let app;
try {
  app = await electron.launch({
    args: ["."],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([k]) => k !== "ELECTRON_RUN_AS_NODE",
        ),
      ),
      BUDDY_DATA_DIR: data,
    },
  });
  await expect
    .poll(() => app.windows().some((p) => p.url().endsWith("index.html")), {
      timeout: 30000,
    })
    .toBe(true);
  const page = app.windows().find((p) => p.url().endsWith("index.html"));
  await page.getByRole("button", { name: "角色空间", exact: true }).click();
  // Preserve the actual transparent WebGL frame for PNG capture.
  await page.evaluate(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
      return get.call(
        this,
        type,
        type === "webgl"
          ? { ...options, preserveDrawingBuffer: true }
          : options,
      );
    };
  });
  for (const [kind, info] of Object.entries(inventory)) {
    if (process.env.BUDDY_PORTRAIT_KINDS && !process.env.BUDDY_PORTRAIT_KINDS.split(',').includes(kind)) continue;
    await page
      .getByRole("button", { name: `预览 ${info.name}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".haru-character")).toHaveAttribute(
      "data-loaded",
      "true",
      { timeout: 30000 },
    );
    const png = await dialog
      .locator("canvas")
      .evaluate((canvas) => canvas.toDataURL("image/png"));
    await writeFile(
      path.join(output, kind + ".png"),
      Buffer.from(png.split(",")[1], "base64"),
    );
    console.log("Captured", kind);
    await dialog.getByRole("button", { name: "关闭预览" }).click();
  }
} finally {
  await app?.close();
  await rm(data, { recursive: true, force: true });
}
