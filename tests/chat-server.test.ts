import { test, expect } from "vitest";
import { createChatServer } from "../src/server/chat-server";
import { once } from "node:events";
import { readSse } from "../src/shared/chat-stream";
test("service pins model, disables thinking and detects unfinished upstream streams", async () => {
  let sent: any,
    complete = true;
  const s = createChatServer({
    key: "private-test-key",
    baseURL: "https://example.aliyuncs.com/v1",
    model: "managed-model",
    fetch: (async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return new Response(
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n' +
          (complete ? "data: [DONE]\n\n" : ""),
      );
    }) as typeof fetch,
  });
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const url = `http://127.0.0.1:${(s.address() as any).port}/chat`;
  try {
    for (const value of [true, false]) {
      complete = value;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "haru",
          name: "小晴",
          model: "untrusted",
          messages: [{ role: "user", content: "今天好吗" }],
        }),
      });
      const events: any[] = [];
      await readSse(r, (d) => events.push(JSON.parse(d)));
      expect(events[0]).toEqual({ type: "delta", text: "你好" });
      expect(events.at(-1).type).toBe(value ? "done" : "error");
      expect(sent.model).toBe("managed-model");
      expect(sent.enable_thinking).toBe(false);
      expect(JSON.stringify(events)).not.toContain("private-test-key");
    }
  } finally {
    s.closeAllConnections();
    s.close();
  }
});
test("local service reports missing credentials and rejects browser origins", async () => {
  const s = createChatServer({});
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const url = `http://127.0.0.1:${(s.address() as any).port}/chat`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "haru",
        name: "Haru",
        messages: [{ role: "user", content: "你好" }],
      }),
    });
    expect(r.status).toBe(503);
    expect(await r.text()).toContain("未配置");
    const cross = await fetch(url, {
      method: "POST",
      headers: { Origin: "https://example.com" },
    });
    expect(cross.status).toBe(403);
  } finally {
    s.closeAllConnections();
    s.close();
  }
});
