import { CubismFramework } from "../../../../vendor/cubism-framework/lib/live2dcubismframework";
let ready = false;
export function ensureCore() {
  if (ready) return;
  if (typeof Live2DCubismCore === "undefined")
    throw new Error("Live2D 运行库缺失，请重新安装");
  if (!CubismFramework.startUp()) throw new Error("Live2D 初始化失败");
  CubismFramework.initialize();
  ready = true;
}
