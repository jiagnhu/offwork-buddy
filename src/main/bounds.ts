export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function clampBounds(bounds: Rectangle, areas: Rectangle[]): Rectangle {
  const area =
    areas.find(
      (a) =>
        bounds.x < a.x + a.width &&
        bounds.x + bounds.width > a.x &&
        bounds.y < a.y + a.height &&
        bounds.y + bounds.height > a.y,
    ) || areas[0];
  const width = Math.min(bounds.width, area.width),
    height = Math.min(bounds.height, area.height);
  return {
    width,
    height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
  };
}
