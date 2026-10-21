import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir, cp } from "node:fs/promises";
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
await cp("resources", "dist/resources", { recursive: true });
