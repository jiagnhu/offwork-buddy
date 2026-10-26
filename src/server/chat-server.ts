import { buildCharacterPrompt } from "./character-prompt";
import { createServer } from "node:http";
import { chatRequestSchema } from "../shared/chat";
import { readSse } from "../shared/chat-stream";
export function createChatServer(config: {
  key?: string;
  baseURL?: string;
  model?: string;
  fetch?: typeof fetch;
}) {
  let busy = false;
  return createServer(async (req, res) => {
    const json = (status: number, error: string) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ error }));
    };
    // No browser access, no remote bind, no user-supplied model or credential.
    if (
      req.headers.origin ||
      !/^((127\.0\.0\.1|localhost)(:\d+)?|\[::1\](:\d+)?)$/.test(
        req.headers.host ?? "",
      )
    ) {
      json(403, "不允许的请求");
      return;
    }
    if (req.method !== "POST" || req.url !== "/chat") {
      json(404, "接口不存在");
      return;
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      json(415, "需要 JSON 请求");
      return;
    }
    if (busy) {
      json(429, "已有请求进行中");
      return;
    }
    if (!config.key || !config.baseURL || !config.model) {
      json(503, "AI 服务未配置");
      return;
    }
    busy = true;
    const abort = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 60000);
    res.on("close", () => abort.abort());
    let streaming = false;
    const event = (value: unknown) => {
      if (!res.destroyed) res.write(`data: ${JSON.stringify(value)}\n\n`);
    };
    try {
      req.setEncoding("utf8");
      let raw = "",
        bytes = 0;
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 100000) {
          json(413, "请求过大");
          return;
        }
        raw += chunk.toString("utf8");
      }
      // Buffer decoding must not split incoming UTF-8 bytes; Node's decoder mode handles it.
      const parsed = chatRequestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        json(400, "聊天内容格式不正确");
        return;
      }
      const { kind, name, messages, purpose } = parsed.data;
      const upstream = await (config.fetch ?? fetch)(
        config.baseURL.replace(/\/$/, "") + "/chat/completions",
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${config.key}`,
            "Content-Type": "application/json",
          },
          signal: abort.signal,
          body: JSON.stringify({
            model: config.model,
            stream: true,
            enable_thinking: false,
            max_tokens: purpose === "interaction" ? 160 : 1024,
            messages: [
              {
                role: "system",
                content: buildCharacterPrompt(kind, name, purpose),
              },
              ...messages,
            ],
          }),
        },
      );
      if (!upstream.ok) {
        json(upstream.status === 429 ? 429 : 502, "AI 服务暂时不可用");
        await upstream.body?.cancel();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      streaming = true;
      let ended = false,
        total = 0;
      await readSse(upstream, (data) => {
        if (data === "[DONE]") {
          ended = true;
          return;
        }
        const payload = JSON.parse(data);
        if (payload.error) throw Error("upstream");
        const text = payload.choices?.[0]?.delta?.content;
        if (typeof text === "string" && !ended) {
          total += text.length;
          if (total > 16000) throw Error("limit");
          event({ type: "delta", text });
        }
      });
      if (!ended) throw Error("incomplete");
      event({ type: "done" });
      res.end();
    } catch {
      if (!res.destroyed) {
        if (streaming) {
          event({
            type: "error",
            message: timedOut ? "上游请求超时，请重试。" : "回复中断，请重试。",
          });
          res.end();
        } else
          json(
            timedOut ? 504 : 502,
            timedOut ? "上游请求超时，请重试。" : "AI 服务暂时不可用，请重试。",
          );
      }
    } finally {
      clearTimeout(timeout);
      abort.abort();
      busy = false;
    }
  });
}
