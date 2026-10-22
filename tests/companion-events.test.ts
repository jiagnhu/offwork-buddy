import { it, expect, vi } from "vitest";
import {
  configureEvents,
  emitCompanionEvent,
  stopEvents,
} from "../src/main/companion-events";
it("reminders preempt but preserve completions and queued reminders run first", () => {
  vi.useFakeTimers();
  const shown: string[] = [];
  configureEvents(
    (e) => shown.push(e.text),
    () => true,
  );
  try {
    emitCompanionEvent("plan-complete", "A");
    emitCompanionEvent("reminder", "R1");
    emitCompanionEvent("plan-complete", "B");
    emitCompanionEvent("reminder", "R2");
    vi.advanceTimersByTime(8000);
    expect(shown).toEqual(["A", "R1", "R2"]);
    vi.advanceTimersByTime(8000);
    expect(shown.at(-1)).toBe("A");
    vi.advanceTimersByTime(4000);
    expect(shown.at(-1)).toBe("B");
  } finally {
    stopEvents();
    vi.useRealTimers();
  }
});

it("five completion events cannot evict a pending reminder", () => {
  vi.useFakeTimers();
  const shown: string[] = [];
  configureEvents(
    (e) => shown.push(e.text),
    () => true,
  );
  try {
    emitCompanionEvent("reminder", "first");
    emitCompanionEvent("reminder", "second");
    for (let n = 0; n < 6; n++) emitCompanionEvent("plan-complete", String(n));
    vi.advanceTimersByTime(8000);
    expect(shown).toEqual(["first", "second"]);
  } finally {
    stopEvents();
    vi.useRealTimers();
  }
});
