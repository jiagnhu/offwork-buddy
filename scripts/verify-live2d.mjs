import { readFile } from "node:fs/promises";
import { resolve, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

export async function verifyAssets(root, lock) {
  const files = new Map();
  for (const entry of lock.files) {
    if (
      /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(entry.path) ||
      entry.mime.startsWith("audio/")
    )
      throw new Error(`Audio forbidden: ${entry.path}`);
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(entry.path) ||
      entry.path.startsWith("/") ||
      entry.path.split("/").some((p) => !p || p === "." || p === "..") ||
      files.has(entry.path)
    )
      throw new Error(`Invalid asset path: ${entry.path}`);
    files.set(entry.path, entry);
  }
  for (const entry of files.values()) {
    const bytes = await readFile(resolve(root, entry.path));
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw new Error(`Asset hash mismatch: ${entry.path}`);
    if (!entry.path.endsWith(".model3.json")) continue;
    const model = JSON.parse(bytes.toString("utf8"));
    function check(value, key = "") {
      if (key === "Sound") throw new Error(`Sound forbidden: ${entry.path}`);
      if (
        typeof value === "string" &&
        (["Moc", "Physics", "Pose", "DisplayInfo", "UserData", "File"].includes(
          key,
        ) ||
          key === "Textures")
      ) {
        const target = posix.join(posix.dirname(entry.path), value);
        if (value.includes("..") || value.includes("\\") || !files.has(target))
          throw new Error(`Unlocked model reference: ${value}`);
      } else if (Array.isArray(value))
        value.forEach((item) => check(item, key));
      else if (value && typeof value === "object")
        Object.entries(value).forEach(([k, v]) => check(v, k));
    }
    check(model.FileReferences);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve("resources/live2d");
  await verifyAssets(
    root,
    JSON.parse(await readFile(resolve(root, "asset-lock.json"), "utf8")),
  );
  console.log("Live2D assets verified");
}
