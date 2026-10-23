import { it, expect, vi, afterEach } from "vitest";
import { ReplyLifetime } from "../src/main/desktop-reply-lifetime";
import type { ChatMessage } from "../src/shared/chat";
const m = (id: string, status: ChatMessage["status"]): ChatMessage => ({
  id,
  status,
  content: "你好",
  role: "assistant",
  at: 0,
});
afterEach(() => vi.useRealTimers());
it("expires ten seconds after completion, never while streaming", () => {
  vi.useFakeTimers();
  const emit = vi.fn();
  const life = new ReplyLifetime(emit);
  life.update(m("a", "streaming"));
  vi.advanceTimersByTime(15000);
  expect(emit.mock.lastCall?.[0]).not.toBeNull();
  life.update(m("a", "complete"));
  vi.advanceTimersByTime(9999);
  expect(emit.mock.lastCall?.[0]).not.toBeNull();
  life.update(m("a", "complete"));
  vi.advanceTimersByTime(1);
  expect(emit.mock.lastCall?.[0]).toBeNull();
  life.update(m("a", "complete"));
  expect(emit.mock.lastCall?.[0]).toBeNull();
});
it("new reply cancels previous timer; dismissed and historical replies stay hidden", () => {
  vi.useFakeTimers();
  const emit = vi.fn();
  const life = new ReplyLifetime(emit);
  life.update(m("old", "complete"));
  expect(emit).not.toHaveBeenCalled();
  life.update(m("a", "streaming"));
  life.update(m("a", "complete"));
  vi.advanceTimersByTime(9000);
  life.update(m("b", "streaming"));
  vi.advanceTimersByTime(2000);
  expect(emit.mock.lastCall?.[0]?.id).toBe("b");
  life.dismiss();
  life.update(m("b", "complete"));
  expect(emit.mock.lastCall?.[0]).toBeNull();
});
