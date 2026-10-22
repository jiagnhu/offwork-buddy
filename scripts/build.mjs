import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir, cp, readFile } from "node:fs/promises";
import { verifyAssets } from './verify-live2d.mjs';
await verifyAssets('resources/live2d', JSON.parse(await readFile('resources/live2d/asset-lock.json','utf8')));
await mkdir("dist/main", { recursive: true });
await build({
  entryPoints: ["src/main/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: "dist/main/index.cjs",
});
await build({
  entryPoints: ["src/preload/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: "dist/main/preload.cjs",
});
await viteBuild();
await mkdir('dist/renderer/live2d',{recursive:true});
await cp('resources/live2d/core/live2dcubismcore.min.js','dist/renderer/live2d/live2dcubismcore.min.js');
await cp("resources", "dist/resources", { recursive: true });
