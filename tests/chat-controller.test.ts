import { test, expect, vi } from "vitest";
import { ChatController, chatTransport } from "../src/main/chat-controller";
test("transport reports service timeout distinctly from connection failure", async () => {
  const body = {
    kind: "haru" as const,
    name: "Haru",
    messages: [{ role: "user" as const, content: "你好" }],
  };
  try {
    vi.stubGlobal("fetch", async () => new Response("", { status: 504 }));
    await expect(
      chatTransport(body, new AbortController().signal, () => {}),
    ).rejects.toThrow("超时");
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(
      chatTransport(body, new AbortController().signal, () => {}),
    ).rejects.toThrow("超时");
  } finally {
    vi.unstubAllGlobals();
  }
});
import { emptyChat } from "../src/shared/chat";
test("only one request starts and character switch stops the active session", async () => {
  let finish: (() => void) | undefined;
  const c = new ChatController(
    emptyChat(),
    async () => {},
    () => {},
    async (_b, signal) => {
      await new Promise<void>((r) => {
        finish = r;
        signal.addEventListener("abort", () => r(), { once: true });
      });
    },
  );
  await c.send("haru", "Haru", "第一句");
  await expect(c.send("mao", "Mao", "第二句")).rejects.toThrow("停止");
  await c.switchCharacter("mao");
  await c.idle();
  expect(c.get().active).toBeNull();
  expect(c.get().sessions.haru.at(-1)?.status).toBe("stopped");
  expect(c.get().sessions.mao).toHaveLength(0);
  finish?.();
});
test("failed stream retries without duplicating user and stopping ignores late chunks", async () => {
  let fail = true;
  const state = emptyChat();
  const c = new ChatController(
    state,
    async () => {},
    () => {},
    async (_body, _signal, delta) => {
      delta("你好");
      if (fail) throw new Error("网络异常");
    },
  );
  await c.send("haru", "Haru", "你好");
  await c.idle();
  expect(c.get().sessions.haru.at(-1)?.status).toBe("error");
  fail = false;
  await c.retry("haru", "Haru");
  await c.idle();
  expect(c.get().sessions.haru).toHaveLength(2);
  expect(c.get().sessions.haru[1].status).toBe("complete");
  let late: ((s: string) => void) | undefined, finish: (() => void) | undefined;
  const d = new ChatController(
    emptyChat(),
    async () => {},
    () => {},
    async (_b, _s, delta) => {
      late = delta;
      await new Promise<void>((r) => (finish = r));
    },
  );
  await d.send("haru", "Haru", "你好");
  await d.stop();
  late?.("迟到");
  finish?.();
  await d.idle();
  expect(d.get().sessions.haru[1].content).toBe("");
  expect(d.get().sessions.haru[1].status).toBe("stopped");
});
test("save failure prevents request and parallel sends cannot both start", async () => {
  let calls = 0;
  const c = new ChatController(
    emptyChat(),
    async () => {
      throw Error("disk");
    },
    () => {},
    async () => {
      calls++;
    },
  );
  await expect(c.send("haru", "Haru", "你好")).rejects.toThrow();
  expect(calls).toBe(0);
  expect(c.get().sessions.haru).toHaveLength(0);
});
