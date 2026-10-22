// Render above the physical display resolution, then let the compositor downsample.
export function rasterSize(
  width: number,
  height: number,
  dpr: number,
  gpuLimit: number,
) {
  const w = Math.max(1, width * dpr * 2),
    h = Math.max(1, height * dpr * 2);
  const scale = Math.min(1, Math.min(gpuLimit, 2048) / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}
