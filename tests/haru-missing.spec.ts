import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, cp, writeFile, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fixture } from "./fixtures";
import { dateKey } from "../src/core/date";
for (const missingCore of [false, true])
  test(`missing ${missingCore ? "Core" : "texture"} is isolated from the rest of the application`, async () => {
    test.setTimeout(60000);
    const root = await mkdtemp(join(tmpdir(), "buddy-missing-"));
    let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
    try {
      await cp(resolve("dist"), join(root, "dist"), { recursive: true });
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({
          main: "dist/main/index.cjs",
          name: "buddy-test",
          version: "1.3.0",
        }),
      );
      const texture = join(
        root,
        missingCore
          ? "dist/renderer/live2d/live2dcubismcore.min.js"
          : "dist/resources/live2d/haru/Haru.2048/texture_00.png",
      );
      const original = await readFile(texture);
      await rm(texture);
      const state = fixture();
      state.preferences.character = "haru";
      state.startDate = dateKey(new Date());
      const data = join(root, "data");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(data);
      await writeFile(join(data, "state.json"), JSON.stringify(state));
      app = await electron.launch({
        args: [root],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key !== "ELECTRON_RUN_AS_NODE",
            ),
          ),
          BUDDY_DATA_DIR: data,
        },
      });
      await expect.poll(() => app!.windows().length).toBe(3);
      const desktop = app
        .windows()
        .find((p) => p.url().endsWith("#companion"))!;
      await expect(desktop.getByRole("alert")).toContainText(
        missingCore ? "角色引擎未能加载" : "纹理加载失败",
        {
          timeout: 30000,
        },
      );
      const card = app
        .windows()
        .find((p) => p.url().endsWith("#desktop-card"))!;
      expect(
        (await card.evaluate(() => window.buddy.getSnapshot())).state
          .preferences.character,
      ).toBe("haru");
      if (missingCore) {
        await desktop.getByRole('alert').getByRole('button',{name:'打开设置',exact:true}).click();
        expect((await card.evaluate(()=>window.buddy.getSnapshot())).state.preferences.character).toBe('haru');
      }
      await writeFile(texture, original);
      if (missingCore) {
        await desktop.reload();
        await desktop.evaluate(() =>
          window.buddy.setPreferences({ character: "haru" }),
        );
      } else
        await desktop
          .getByRole("button", { name: "重试", exact: true })
          .click();
      await expect(desktop.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 30000 },
      );
    } finally {
      await app?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
