import { execFileSync } from "node:child_process";
// Developer-only import of the official SDK. Builds never download assets.
import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { verifyAssets } from "./verify-live2d.mjs";
const version = "5-r.5";
const source = `https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-${version}.zip`;
const sdk = resolve(process.argv[2] || `.cache/sdk/CubismSdkForWeb-${version}`);
const archive = await readFile(
  resolve(".cache", `CubismSdkForWeb-${version}.zip`),
);
if (
  createHash("sha256").update(archive).digest("hex") !==
  "67064a7fb1812cf502f5c4a03bfe12cc638c75a621bb4acf06bb28763df06ba0"
)
  throw new Error("Official SDK archive hash mismatch");
const dest = resolve("resources/live2d");
await mkdir(join(dest, "haru"), { recursive: true });
await mkdir(join(dest, "core"), { recursive: true });
await mkdir(join(dest, "licenses"), { recursive: true });
const origin = join(sdk, "Samples/Resources/Haru");
const model = JSON.parse(
  await readFile(join(origin, "Haru.model3.json"), "utf8"),
);
const refs = model.FileReferences;
if (
  refs.Expressions.length !== 8 ||
  refs.Motions.Idle.length !== 2 ||
  refs.Motions.TapBody.length !== 4
)
  throw new Error("Unexpected Haru inventory");
for (const group of Object.values(refs.Motions))
  for (const motion of group) delete motion.Sound;
const paths = [
  refs.Moc,
  ...refs.Textures,
  refs.Physics,
  refs.Pose,
  refs.DisplayInfo,
  refs.UserData,
  ...refs.Expressions.map((e) => e.File),
  ...Object.values(refs.Motions)
    .flat()
    .map((m) => m.File),
];
for (const p of paths) {
  await mkdir(join(dest, "haru", p, ".."), { recursive: true });
  await cp(join(origin, p), join(dest, "haru", p));
}
await writeFile(
  join(dest, "haru/Haru.model3.json"),
  JSON.stringify(model, null, 2) + "\n",
);
for (const p of [
  "live2dcubismcore.min.js",
  "live2dcubismcore.d.ts",
  "LICENSE.md",
  "RedistributableFiles.txt",
])
  await cp(join(sdk, "Core", p), join(dest, "core", p));
await cp(join(sdk, "Framework/src"), resolve("vendor/cubism-framework/src"), {
  recursive: true,
});
execFileSync("git", [
  "apply",
  "--ignore-space-change",
  "scripts/cubism-framework.patch",
]);
await cp(join(sdk, "Framework/Shaders/WebGL"), join(dest, "haru/shaders"), {
  recursive: true,
});
await cp(
  join(sdk, "Framework/LICENSE.md"),
  resolve("vendor/cubism-framework/LICENSE.md"),
);
await cp(join(sdk, "LICENSE.md"), join(dest, "licenses/SDK-LICENSE.md"));
await cp(
  join(sdk, "Framework/LICENSE.md"),
  join(dest, "licenses/Framework-LICENSE.md"),
);
await cp(
  resolve("THIRD_PARTY_NOTICES.md"),
  join(dest, "licenses/THIRD_PARTY_NOTICES.md"),
);
const files = [];
async function walk(dir, prefix = "") {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + ent.name;
    if (ent.isDirectory()) await walk(join(dir, ent.name), path + "/");
    else if (path !== "asset-lock.json")
      files.push({
        path,
        sha256: createHash("sha256")
          .update(await readFile(join(dir, ent.name)))
          .digest("hex"),
        mime: path.endsWith(".json")
          ? "application/json"
          : path.endsWith(".png")
            ? "image/png"
            : path.endsWith(".js")
              ? "text/javascript"
              : path.endsWith(".moc3")
                ? "application/octet-stream"
                : "text/plain",
      });
  }
}
await walk(dest);
const lock = {
  sdkVersion: version,
  frameworkCommit: "d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b",
  modelCommit: "ed1e0b714826d92469b9e51cacc3346f4e393f03",
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
  sources: [
    {
      url: source,
      license:
        "SDK licenses retained in licenses/; Core proprietary, Framework open software, Haru free material + sample terms",
    },
  ],
  modifications: [
    "Framework adapter patch: cancellable shader prepare and per-context release; official shaders unchanged.",
    "Haru.model3.json: removed all four Sound properties; audio omitted from app.",
    "All files extracted from pinned official SDK archive SHA256 67064a7fb1812cf502f5c4a03bfe12cc638c75a621bb4acf06bb28763df06ba0.",
  ],
};
await verifyAssets(dest, lock);
await writeFile(
  join(dest, "asset-lock.json"),
  JSON.stringify(lock, null, 2) + "\n",
);
console.log(`Prepared ${files.length} verified assets`);
