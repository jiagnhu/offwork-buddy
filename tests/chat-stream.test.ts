import { test, expect } from "vitest";
import { readSse } from "../src/shared/chat-stream";
test("SSE handles split UTF8 and multiline chunks", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"text":"你好"}\r\n\r\ndata: [DONE]\n\n',
  );
  let i = 0;
  const body = new ReadableStream({
    pull(c) {
      i < bytes.length ? c.enqueue(bytes.slice(i, (i += 1))) : c.close();
    },
  });
  const result: string[] = [];
  await readSse(new Response(body), (d) => {
    result.push(d);
  });
  expect(result).toEqual(['{"text":"你好"}', "[DONE]"]);
});
