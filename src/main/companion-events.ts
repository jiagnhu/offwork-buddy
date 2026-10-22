import type { CompanionEvent } from "../shared/model";
let delivery: (e: CompanionEvent) => void = () => {},
  visible = () => false;
let active: CompanionEvent | null = null,
  timer: ReturnType<typeof setTimeout> | undefined;
let queued: CompanionEvent[] = [];
export function configureEvents(
  send: (e: CompanionEvent) => void,
  isVisible: () => boolean,
) {
  delivery = send;
  visible = isVisible;
}
export function reactionUntil() {
  return active ? active.createdAt + active.durationMs : 0;
}
export function stopEvents() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  active = null;
  queued = [];
}
export function emitCompanionEvent(kind: CompanionEvent["kind"], text: string) {
  if (!visible()) return;
  const e: CompanionEvent = {
    id: crypto.randomUUID(),
    kind,
    text,
    createdAt: Date.now(),
    durationMs: kind === "reminder" ? 8000 : 4000,
  };
  if (active && kind !== "reminder") {
    if (kind === "plan-complete")
      queued = [
        ...queued.filter((x) => x.kind === "reminder"),
        ...queued.filter((x) => x.kind === "plan-complete").slice(-4),
        e,
      ];
    return;
  }
  if (active && kind === "reminder" && active.kind === "reminder") {
    queued = [
      ...queued.filter((x) => x.kind === "reminder"),
      e,
      ...queued.filter((x) => x.kind !== "reminder"),
    ];
    return;
  }
  if (active?.kind === "plan-complete" && kind === "reminder")
    queued = [
      ...queued.filter((x) => x.kind === "reminder"),
      active,
      ...queued.filter((x) => x.kind === "plan-complete").slice(-4),
    ];
  show(e);
}
function show(e: CompanionEvent) {
  if (timer) clearTimeout(timer);
  if (!visible()) {
    stopEvents();
    return;
  }
  active = { ...e, createdAt: Date.now() };
  delivery(active);
  timer = setTimeout(() => {
    active = null;
    const next = queued.shift();
    if (next) show(next);
  }, e.durationMs);
}
