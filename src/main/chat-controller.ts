import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  contextMessages,
  type ChatState,
  type ChatMessage,
  type chatRequestSchema,
} from "../shared/chat";
import type { Live2dKind } from "../shared/characters";
import { readSse } from "../shared/chat-stream";
type Transport = (
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
export class ChatController {
  private queue: Promise<unknown> = Promise.resolve();
  private run: Promise<void> = Promise.resolve();
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private state: ChatState,
    private save: (state: ChatState) => Promise<void>,
    private publish: (state: ChatState) => void,
    private transport: Transport = chatTransport,
  ) {}
  get() {
    return structuredClone(this.state);
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  private emit() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.publish(this.get());
  }
  private async persist() {
    try {
      await this.save(this.get());
      if (this.state.notice?.includes("原文件已保留")) delete this.state.notice;
    } catch {
      this.state.notice = "聊天记录保存失败，请检查磁盘空间和权限。";
      this.emit();
      throw Error(this.state.notice);
    }
  }
  send(kind: Live2dKind, name: string, text: string) {
    return this.serial(async () => {
      const content = z.string().trim().min(1).max(2000).parse(text);
      if (this.state.active) throw Error("请先停止当前回复。");
      const before = this.get();
      const user: ChatMessage = {
        id: randomUUID(),
        role: "user",
        content,
        at: Date.now(),
        status: "complete",
      };
      this.state.sessions[kind].push(user);
      try {
        return await this.begin(kind, name);
      } catch (e) {
        this.state = before;
        this.emit();
        throw e;
      }
    });
  }
  retry(kind: Live2dKind, name: string) {
    return this.serial(async () => {
      if (this.state.active) throw Error("请先停止当前回复。");
      const list = this.state.sessions[kind],
        last = list.at(-1);
      if (
        !last ||
        last.role !== "assistant" ||
        !["error", "stopped"].includes(last.status)
      )
        throw Error("没有可重试的回复。");
      const before = this.get();
      list.pop();
      try {
        return await this.begin(kind, name);
      } catch (e) {
        this.state = before;
        this.emit();
        throw e;
      }
    });
  }
  private async begin(kind: Live2dKind, name: string) {
    const messages = contextMessages(this.state.sessions[kind]);
    const assistant: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: "",
      at: Date.now(),
      status: "streaming",
    };
    this.state.sessions[kind].push(assistant);
    this.state.sessions[kind] = this.state.sessions[kind].slice(-500);
    this.state.active = { kind, id: assistant.id };
    await this.persist();
    this.emit();
    const abort = new AbortController();
    this.abort = abort;
    const current = () => this.state.active?.id === assistant.id;
    this.run = (async () => {
      let error: string | undefined;
      try {
        await this.transport({ kind, name, messages }, abort.signal, (text) => {
          if (!current() || abort.signal.aborted) return;
          if (assistant.content.length + text.length > 16000)
            throw Error("回复超过长度限制，请重试。");
          assistant.content += text;
          if (!this.timer) this.timer = setTimeout(() => this.emit(), 40);
        });
        if (!assistant.content) throw Error("未收到有效回复，请重试。");
      } catch (e) {
        error = e instanceof Error ? e.message : "回复失败，请重试。";
      }
      await this.serial(async () => {
        if (!current()) return;
        assistant.status = error ? "error" : "complete";
        assistant.error = error;
        this.state.active = null;
        this.abort = null;
        await this.persist().catch(() => {});
        this.emit();
      });
    })();
    return this.get();
  }
  stop() {
    return this.serial(async () => {
      const active = this.state.active;
      if (active) {
        this.abort?.abort();
        this.abort = null;
        const message = this.state.sessions[active.kind].find(
          (m) => m.id === active.id,
        );
        if (message) message.status = "stopped";
        this.state.active = null;
        await this.persist();
        this.emit();
      }
      return this.get();
    });
  }
  async switchCharacter(kind: Live2dKind) {
    if (this.state.active && this.state.active.kind !== kind) await this.stop();
  }
  clear(kind: Live2dKind) {
    return this.serial(async () => {
      if (this.state.active) throw Error("请先停止当前回复，再清空记录。");
      const previous = this.state.sessions[kind];
      this.state.sessions[kind] = [];
      try {
        await this.persist();
      } catch (e) {
        this.state.sessions[kind] = previous;
        throw e;
      }
      this.emit();
      return this.get();
    });
  }
  async idle() {
    await this.run;
    await this.queue;
  }
  async flush() {
    await this.stop();
    await this.idle();
  }
}
