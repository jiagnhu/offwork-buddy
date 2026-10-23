interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function desktopReplyBounds(
  anchor: Rect,
  area: Rect,
  requestedHeight = 100,
): Rect {
  const width = Math.min(340, area.width),
    height = Math.min(requestedHeight, area.height);
  // Character canvases contain transparent side margins. Bring the tail closer.
  const center = anchor.x + anchor.width / 2;
  const right = center + 95;
  const left = center - 95 - width;
  const x = right + width <= area.x + area.width ? right : left;
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(
      Math.max(area.y, Math.min(anchor.y + 50, area.y + area.height - height)),
    ),
    width,
    height,
  };
}
export function desktopChatBounds(anchor: Rect, area: Rect): Rect {
  const width = Math.min(320, area.width),
    height = Math.min(72, area.height);
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(
          anchor.x + (anchor.width - width) / 2,
          area.x + area.width - width,
        ),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(anchor.y + anchor.height + 4, area.y + area.height - height),
      ),
    ),
    width,
    height,
  };
}
