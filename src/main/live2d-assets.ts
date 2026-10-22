import { protocol } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetLock } from "../../scripts/verify-live2d.mjs";
export function resolveLive2dAsset(
  url: string,
  lock: AssetLock,
): { relativePath: string; mime: string } | null {
  // Match raw input before URL parsing can normalize traversal or escapes.
  const match = /^buddy-live2d:\/\/assets\/((?:haru|mao|hiyori|miara|rice)\/[A-Za-z0-9_./-]+)$/.exec(url);
  if (!match || match[1].split("/").some((p) => !p || p === "." || p === ".."))
    return null;
  const file = lock.files.find((f) => f.path === match[1]);
  return file ? { relativePath: file.path, mime: file.mime } : null;
}
export function registerLive2dScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "buddy-live2d",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}
export function installLive2dProtocol(resourceRoot: string, lock: AssetLock) {
  protocol.handle("buddy-live2d", async (request) => {
    const headers = {
      "Access-Control-Allow-Origin": "null",
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    };
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405, headers });
    const asset = resolveLive2dAsset(request.url, lock);
    if (!asset) return new Response(null, { status: 404, headers });
    try {
      const bytes = await readFile(join(resourceRoot, asset.relativePath));
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: { ...headers, "Content-Type": asset.mime },
      });
    } catch {
      return new Response(null, { status: 404, headers });
    }
  });
}
