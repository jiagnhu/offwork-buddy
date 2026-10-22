import { test, expect } from "@playwright/test";
import { launchDesktop } from "./desktop-helper";
import { characterOrder, live2dModels } from "../src/shared/characters";

test("all five characters respond to canvas clicks using only original actions", async () => {
  test.setTimeout(150000);
  const s = await launchDesktop(state=>{state.preferences.reducedMotion=true;});
  try {
    const errors: string[] = [];
    s.page.on("pageerror", (e) => errors.push(e.message));
    await s.page.evaluate(() => {
      const original = Live2DCubismCore.Model.fromMoc;
      Live2DCubismCore.Model.fromMoc = function (moc) {
        const model = original(moc);
        (window as any).__clickModel = model;
        return model;
      };
    });
    await s.page.getByRole("button", { name: "角色空间", exact: true }).click();
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
      if(kind==='haru') {
        const opacity=await s.page.evaluate(()=>{
          const p=(window as any).__clickModel.parts;
          return Object.fromEntries(p.ids.map((id:string,i:number)=>[id,p.opacities[i]]));
        });
        expect(opacity.Part01ArmRA001+opacity.Part01ArmRB001).toBeLessThanOrEqual(1.01);
        expect(opacity.Part01ArmLA001+opacity.Part01ArmLB001).toBeLessThanOrEqual(1.01);
        await s.page.evaluate(()=>window.buddy.setPreferences({reducedMotion:false}));
      }
      await expect(
        dialog.getByRole("heading", { name: "专属动作" }),
      ).toHaveCount(0);
      for (const value of [0, 0.4, 0.9]) {
        await s.page.evaluate((value) => {
          Math.random = () => value;
        }, value);
        await dialog.locator("canvas").click();
        await s.page.waitForTimeout(400);
        await expect(dialog.getByRole("alert")).toHaveCount(0);
      }
      if (kind === "haru" || kind === "mao") {
        await s.page.evaluate(() =>
          window.buddy.setPreferences({ reducedMotion: true }),
        );
        await dialog
          .getByRole("button", { name: "表情 1", exact: true })
          .click();
        await s.page.waitForTimeout(100);
        const before = await s.page.evaluate(() =>
          Array.from((window as any).__clickModel.parameters.values),
        );
        await s.page.evaluate(() => {
          Math.random = () => 0;
        });
        await dialog.locator("canvas").click();
        await expect
          .poll(() =>
            s.page.evaluate(() =>
              Array.from((window as any).__clickModel.parameters.values),
            ),
          )
          .not.toEqual(before);
        await s.page.evaluate(() =>
          window.buddy.setPreferences({ reducedMotion: false }),
        );
      }
      await dialog.getByRole("button", { name: "关闭预览" }).click();
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
