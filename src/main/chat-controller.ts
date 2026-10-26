import { z } from "zod";
import { type chatRequestSchema } from "../shared/chat";
import { readSse } from "../shared/chat-stream";
export type Transport = (
  body: z.infer<typeof chatRequestSchema>,
  signal: AbortSignal,
  delta: (text: string) => void,
) => Promise<void>;
export const chatTransport = async (
  body: Parameters<Transport>[0],
  signal: AbortSignal,
  delta: (text: string) => void,
  endpointOverride?: string,
) => {
  const endpoint =
    endpointOverride ??
    process.env.BUDDY_CHAT_SERVICE ??
    "http://127.0.0.1:17863";
  const url = new URL(endpoint);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw Error("开发版聊天仅连接本机服务");
  let response: Response;
  const deadline = AbortSignal.timeout(90000);
  try {
    response = await fetch(new URL("/chat", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, deadline]),
    });
  } catch (error) {
    if (
      deadline.aborted ||
      (error instanceof Error && error.name === "TimeoutError")
    )
      throw Error("聊天请求超时，请重试。");
    throw Error("聊天服务未连接，请启动本机 AI 服务后重试。");
  }
  if (!response.ok)
    throw Error(
      response.status === 504
        ? "上游请求超时，请重试。"
        : response.status === 503
          ? "AI 服务未配置，请由开发者完成百炼配置。"
          : response.status === 429
            ? "请求较多，请稍后重试。"
            : "聊天服务暂时不可用，请稍后重试。",
    );
  let done = false;
  try {
    await readSse(response, (data) => {
      const event = JSON.parse(data);
      if (event.type === "done") {
        done = true;
        return;
      }
      if (event.type === "error")
        throw Error(
          [
            "上游请求超时，请重试。",
            "AI 服务暂时不可用，请重试。",
            "回复中断，请重试。",
          ].includes(event.message)
            ? event.message
            : "AI 服务暂时不可用，请重试。",
        );
      if (event.type === "delta" && typeof event.text === "string" && !done)
        delta(event.text);
    });
  } catch (error) {
    if (deadline.aborted) throw Error("聊天请求超时，请重试。");
    const message = error instanceof Error ? error.message : "";
    throw Error(
      [
        "上游请求超时，请重试。",
        "AI 服务暂时不可用，请重试。",
        "回复中断，请重试。",
        "回复超过长度限制，请重试。",
      ].includes(message)
        ? message
        : "回复中断，请重试。",
    );
  }
  if (!done) throw Error("回复中断，请重试。");
};
export { ChatController } from "./chat-session";
