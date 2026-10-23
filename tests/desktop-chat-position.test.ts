import { describe, it, expect } from "vitest";
import { desktopChatBounds } from "../src/main/desktop-chat-position";
describe("desktop chat placement", () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  it("places beside the character without covering it", () => {
    const b = desktopChatBounds(
      { x: 300, y: 300, width: 360, height: 600 },
      area,
    );
    expect(b.x).toBeGreaterThanOrEqual(660);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });
  it("switches to the left at the right edge", () => {
    const b = desktopChatBounds(
      { x: 1560, y: 440, width: 360, height: 600 },
      area,
    );
    expect(b.x + b.width).toBeLessThanOrEqual(1560);
    expect(b.y + b.height).toBeLessThanOrEqual(1040);
  });
  it.each([
    { x: -1280, y: -200, width: 1280, height: 720 },
    { x: 0, y: 0, width: 320, height: 280 },
  ])("fits work area %o", (a) => {
    const b = desktopChatBounds({ x: a.x, y: a.y, width: 360, height: 600 }, a);
    expect(b.x).toBeGreaterThanOrEqual(a.x);
    expect(b.y).toBeGreaterThanOrEqual(a.y);
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width);
    expect(b.y + b.height).toBeLessThanOrEqual(a.y + a.height);
  });
});
