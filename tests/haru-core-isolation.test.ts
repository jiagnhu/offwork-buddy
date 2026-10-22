import { test, expect } from "vitest";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
test("missing Core does not prevent the shared character module from loading", async () => {
  const result = await build({
    entryPoints: ["src/renderer/characters/Character.tsx"],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  expect(() =>
    runInNewContext(result.outputFiles[0].text, {
      module: { exports: {} },
      exports: {},
      console,
    }),
  ).not.toThrow();
});
