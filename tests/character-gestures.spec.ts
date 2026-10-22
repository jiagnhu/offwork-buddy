import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { characterOrder, live2dModels } from "../src/shared/characters";
import {
  gestureLabels,
  sampleGesture,
  type GestureCue,
} from "../src/renderer/characters/live2d/gestures";

test("all character gestures affect real model parameters and remain stable when reduced", async () => {
  test.setTimeout(180000);
  const s = await launchDesktop((state) => {
    state.preferences.reducedMotion = true;
  });
  try {
    const errors: string[] = [];
    s.page.on("pageerror", (e) => errors.push(e.message));
    await s.page.evaluate(() => {
      const core = (window as any).Live2DCubismCore;
      const original = core.Model.fromMoc;
      core.Model.fromMoc = function (...args: any[]) {
        const model = original.apply(this, args);
        (window as any).__gestureModel = model;
        return model;
      };
    });
    await s.page.getByRole("button", { name: "偏好设置", exact: true }).click();
    const values = () =>
      s.page.evaluate(() => {
        const p = (window as any).__gestureModel.parameters;
        return Object.fromEntries(
          p.ids.map((id: string, i: number) => [id, p.values[i]]),
        ) as Record<string, number>;
      });
    for (const kind of characterOrder) {
      await s.page
        .getByRole("button", {
          name: `预览 ${live2dModels[kind].name}`,
          exact: true,
        })
        .click();
      const dialog = s.page.getByRole("dialog");
      await expect(dialog.locator(".haru-character")).toHaveAttribute(
        "data-loaded",
        "true",
        { timeout: 30000 },
      );
      const neutral = await values();
      for (const [cue, label] of Object.entries(gestureLabels[kind])) {
        const ids = Object.keys(sampleGesture(kind, cue as GestureCue, 0.4));
        expect(ids.filter((id) => !(id in neutral))).toEqual([]);
        await dialog.getByRole("button", { name: label, exact: true }).click();
        await expect
          .poll(async () => {
            const pose = await values();
            return ids.some((id) => Math.abs(pose[id] - neutral[id]) > 0.01);
          })
          .toBe(true);
        const pose = await values();
        await s.page.waitForTimeout(150);
        expect(await values()).toEqual(pose);
        // Another invalidation must not accumulate additive expression offsets.
        await dialog.getByRole("button", { name: label, exact: true }).click();
        await s.page.waitForTimeout(100);
        expect(await values()).toEqual(pose);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      }
      await dialog.screenshot({
        path: `test-results/gesture-${kind}-static.png`,
      });
      await s.page.evaluate(() =>
        window.buddy.setPreferences({ reducedMotion: false }),
      );
      await dialog
        .getByRole("button", { name: gestureLabels[kind].happy, exact: true })
        .click();
      const before = await values();
      await s.page.waitForTimeout(1500);
      const after = await values();
      expect(
        Object.keys(after).some(
          (id) => Math.abs(after[id] - before[id]) > 0.01,
        ),
      ).toBe(true);
      await dialog.screenshot({
        path: `test-results/gesture-${kind}-happy.png`,
      });
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await dialog.getByRole("button", { name: "关闭预览" }).click();
      await s.page.evaluate(() =>
        window.buddy.setPreferences({ reducedMotion: true }),
      );
    }
    expect(errors).toEqual([]);
    expect(
      (await s.page.evaluate(() => window.buddy.getSnapshot())).state.growth
        .points,
    ).toBe(0);
  } finally {
    await s.cleanup();
  }
});
