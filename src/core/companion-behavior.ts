import { clampBounds, type Rectangle } from "../main/bounds";
export type Point = { x: number; y: number };
export interface BehaviorState {
  phase: "idle" | "walking" | "resting" | "reacting" | "dragging" | "paused";
  position: Point;
  target?: Point;
  direction: "left" | "right";
  phaseUntil: number;
  lastTick: number;
  pointerLeftAt: number | null;
  manualHoldUntil: number;
  from?: Point;
  started?: number;
}
export interface BehaviorInput {
  now: number;
  random: number;
  workArea: Rectangle;
  windowSize: { width: number; height: number };
  cardBounds: Rectangle | null;
  pointer: Point;
  visible: boolean;
  suspended: boolean;
  reducedMotion: boolean;
  mode: "bottom" | "stationary";
  dragging: boolean;
  reactionUntil: number;
}
export function holdAt(position: Point, now: number): BehaviorState {
  return {
    phase: "idle",
    position,
    direction: "right",
    phaseUntil: now + 60000,
    lastTick: now,
    pointerLeftAt: null,
    manualHoldUntil: now + 60000,
  };
}
function overlaps(a: Rectangle, b: Rectangle) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
function overlapArea(a: Rectangle, b: Rectangle) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  );
}
export function stepBehavior(
  current: BehaviorState,
  i: BehaviorInput,
): BehaviorState {
  const s = { ...current, position: { ...current.position }, lastTick: i.now };
  const r = Math.max(0, Math.min(1, i.random));
  const stopped = (phase: BehaviorState["phase"]) => ({
    ...s,
    phase,
    target: undefined,
    phaseUntil: Math.max(s.manualHoldUntil, i.now),
  });
  if (!i.visible || i.suspended || i.reducedMotion || i.mode === "stationary")
    return stopped("paused");
  if (i.dragging)
    return { ...stopped("dragging"), manualHoldUntil: i.now + 60000 };
  if (i.now - current.lastTick > 2000 || i.now < current.lastTick)
    return { ...stopped("idle"), phaseUntil: i.now + 20000 };
  const bounds = { ...s.position, ...i.windowSize };
  if (
    overlaps(
      {
        ...bounds,
        x: bounds.x - 60,
        y: bounds.y - 60,
        width: bounds.width + 120,
        height: bounds.height + 120,
      },
      { ...i.pointer, width: 1, height: 1 },
    )
  )
    return { ...stopped("paused"), pointerLeftAt: null };
  if (s.pointerLeftAt === null) s.pointerLeftAt = i.now;
  if (i.now - s.pointerLeftAt < 2000) return stopped("paused");
  if (i.reactionUntil > i.now)
    return { ...stopped("reacting"), phaseUntil: i.reactionUntil };
  if (i.now < s.manualHoldUntil) return stopped("idle");
  if (s.phase === "walking" && s.target && s.from && s.started !== undefined) {
    const f = Math.max(
      0,
      Math.min(1, (i.now - s.started) / (s.phaseUntil - s.started)),
    );
    const position = {
      x: Math.round(s.from.x + (s.target.x - s.from.x) * f),
      y: Math.round(s.from.y + (s.target.y - s.from.y) * f),
    };
    if (
      i.cardBounds &&
      overlaps({ ...position, ...i.windowSize }, i.cardBounds) &&
      overlapArea({ ...position, ...i.windowSize }, i.cardBounds) >=
        overlapArea(bounds, i.cardBounds)
    )
      return { ...stopped("idle"), phaseUntil: i.now + 20000 };
    const bounded = clampBounds({ ...position, ...i.windowSize }, [i.workArea]);
    s.position = { x: bounded.x, y: bounded.y };
    return f >= 1
      ? {
          ...s,
          phase: r < 0.55 ? "resting" : "idle",
          target: undefined,
          phaseUntil: i.now + 20000 + 25000 * r,
        }
      : s;
  }
  if (i.now < s.phaseUntil) return s;
  const area = i.workArea,
    w = Math.min(i.windowSize.width, area.width),
    h = Math.min(i.windowSize.height, area.height);
  const bottom =
    area.y + area.height - h - Math.min(12, Math.max(0, area.height - h));
  let minX = area.x,
    maxX = area.x + area.width - w;
  // Treat a card occupying the bottom strip as an edge of the reachable lane.
  // Otherwise its nearest safe point can equal our current position forever.
  const card = i.cardBounds;
  if (card && card.y < bottom + h && card.y + card.height > bottom) {
    if (s.position.x + w <= card.x)
      maxX = Math.max(minX, Math.min(maxX, card.x - w - 12));
    else if (s.position.x >= card.x + card.width)
      minX = Math.min(maxX, Math.max(minX, card.x + card.width + 12));
  }
  const distance = 80 + 80 * r,
    sign = s.direction === "right" ? 1 : -1;
  let x = s.position.x + distance * sign;
  if (x < minX || x > maxX) {
    s.direction = sign === 1 ? "left" : "right";
    x = s.position.x - distance * sign;
  }
  x = Math.max(minX, Math.min(maxX, x));
  let target = { x, y: bottom };
  const blocked = (p: Point) =>
    i.cardBounds && overlaps({ ...p, width: w, height: h }, i.cardBounds);
  if (blocked(target)) {
    const alternatives = [
      {
        x: Math.max(minX, Math.min(maxX, i.cardBounds!.x - w - 12)),
        y: bottom,
      },
      {
        x: Math.max(
          minX,
          Math.min(maxX, i.cardBounds!.x + i.cardBounds!.width + 12),
        ),
        y: bottom,
      },
    ];
    const valid = alternatives
      .filter((p) => !blocked(p))
      .sort(
        (a, b) => Math.abs(a.x - s.position.x) - Math.abs(b.x - s.position.x),
      );
    if (!valid.length) return { ...stopped("idle"), phaseUntil: i.now + 20000 };
    target = valid[0];
  }
  // A conservative swept rectangle avoids moving through the fixed card.
  const swept = {
    x: Math.min(s.position.x, target.x),
    y: Math.min(s.position.y, target.y),
    width: Math.abs(target.x - s.position.x) + w,
    height: Math.abs(target.y - s.position.y) + h,
  };
  if (i.cardBounds && overlaps(bounds, i.cardBounds)) {
    const exits = [
      i.cardBounds.x - w - 12,
      i.cardBounds.x + i.cardBounds.width + 12,
    ]
      .filter((x) => x >= minX && x <= maxX)
      .sort((a, b) => Math.abs(a - s.position.x) - Math.abs(b - s.position.x));
    if (!exits.length) return { ...stopped("idle"), phaseUntil: i.now + 20000 };
    target = { x: exits[0], y: s.position.y };
  } else if (i.cardBounds && overlaps(swept, i.cardBounds)) {
    const sideways = { x: target.x, y: s.position.y };
    const sweepX = {
      x: Math.min(s.position.x, sideways.x),
      y: s.position.y,
      width: Math.abs(sideways.x - s.position.x) + w,
      height: h,
    };
    if (overlaps(sweepX, i.cardBounds) || sideways.x === s.position.x)
      return { ...stopped("idle"), phaseUntil: i.now + 20000 };
    target = sideways;
  }
  if (target.x === s.position.x && target.y === s.position.y)
    return { ...stopped("resting"), phaseUntil: i.now + 20000 };
  const duration = Math.max(
    4000 + 4000 * r,
    Math.abs(target.y - s.position.y) / 0.04,
  );
  return {
    ...s,
    phase: "walking",
    target,
    from: { ...s.position },
    started: i.now,
    phaseUntil: i.now + duration,
    direction: target.x < s.position.x ? "left" : "right",
  };
}
