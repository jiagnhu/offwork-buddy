export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function clampBounds(bounds: Rectangle, areas: Rectangle[]): Rectangle {
  if (!areas.length) return bounds;
  const overlap = (a: Rectangle) =>
    Math.max(
      0,
      Math.min(bounds.x + bounds.width, a.x + a.width) -
        Math.max(bounds.x, a.x),
    ) *
    Math.max(
      0,
      Math.min(bounds.y + bounds.height, a.y + a.height) -
        Math.max(bounds.y, a.y),
    );
  const area = areas.reduce((best, a) =>
    overlap(a) > overlap(best) ? a : best,
  );
  const width = Math.min(bounds.width, area.width),
    height = Math.min(bounds.height, area.height);
  return {
    width,
    height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
  };
}
