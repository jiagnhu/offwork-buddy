import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createChatServer } from "../server/chat-server";
import {
  aiSettingsSchema,
  type AISettingsInput,
  type AISettingsView,
} from "../shared/ai-settings";
type Cipher = {
  isEncryptionAvailable: () => boolean;
  encryptString: (text: string) => Buffer;
  decryptString: (value: Buffer) => string;
};
export class AISettings {
  private config: AISettingsInput | null = null;
  private server: ReturnType<typeof createChatServer> | null = null;
  endpoint: string | undefined;
  private notice: string | undefined;
  constructor(
    private directory: string,
    private enabled: boolean,
    private cipher: Cipher,
    private request: typeof fetch = fetch,
  ) {}
  view(): AISettingsView {
    return {
      enabled: this.enabled,
      hasKey: !!this.config?.key,
      baseURL:
        this.config?.baseURL ??
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: this.config?.model ?? "",
      running: !!this.server,
      notice: this.notice,
    };
  }
  private require() {
    if (!this.enabled) throw Error("此功能仅限开发版。");
    if (!this.cipher.isEncryptionAvailable())
      throw Error("系统加密暂不可用，无法安全保存或读取密钥。");
  }
  private resolve(input: unknown) {
    this.require();
    const value = aiSettingsSchema.parse(input);
    const key = value.key || this.config?.key;
    if (!key) throw Error("请输入百炼 API Key。");
    return { ...value, key, baseURL: value.baseURL.replace(/\/$/, "") };
  }
  async load() {
    if (!this.enabled) return;
    try {
      const raw = await readFile(
        path.join(this.directory, "ai-settings.json"),
        "utf8",
      );
      this.require();
      const saved = z
        .object({
          version: z.literal(1),
          baseURL: z.string(),
          model: z.string(),
          encryptedKey: z.string().max(20000),
        })
        .parse(JSON.parse(raw));
      const config = this.resolve({
        baseURL: saved.baseURL,
        model: saved.model,
        key: this.cipher.decryptString(
          Buffer.from(saved.encryptedKey, "base64"),
        ),
      });
      const started = await this.start(config);
      this.config = config;
      this.server = started.server;
      this.endpoint = started.endpoint;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        this.notice =
          "AI 配置无法读取或服务启动失败，请重新配置；原文件已保留。";
    }
  }
  private async start(config: AISettingsInput) {
    const server = createChatServer(config);
    server.requestTimeout = 65000;
    server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    return {
      server,
      endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    };
  }
  async save(input: unknown) {
    const config = this.resolve(input);
    const started = await this.start(config);
    try {
      await mkdir(this.directory, { recursive: true });
      const file = path.join(this.directory, "ai-settings.json");
      await writeFile(
        file + ".tmp",
        JSON.stringify({
          version: 1,
          baseURL: config.baseURL,
          model: config.model,
          encryptedKey: this.cipher
            .encryptString(config.key)
            .toString("base64"),
        }),
        "utf8",
      );
      await rename(file + ".tmp", file);
    } catch {
      started.server.closeAllConnections();
      started.server.close();
      throw Error("AI 配置保存失败，请检查磁盘空间和权限。");
    }
    await this.close();
    this.config = config;
    this.server = started.server;
    this.endpoint = started.endpoint;
    this.notice = undefined;
    return this.view();
  }
  async test(input: unknown) {
    const config = this.resolve(input);
    let response: Response;
    try {
      response = await this.request(config.baseURL + "/chat/completions", {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: "请回复：连接成功" }],
          enable_thinking: false,
          stream: false,
          max_tokens: 16,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      throw Error(
        e instanceof Error && e.name === "TimeoutError"
          ? "连接测试超时，请检查网络或稍后再试。"
          : "无法连接百炼，请检查网络与服务地址。",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(
        response.status === 401 || response.status === 403
          ? "密钥无效或没有访问权限，请检查密钥与地域。"
          : response.status === 429
            ? "请求限流或额度不足，请检查百炼控制台。"
            : response.status === 400 || response.status === 404
              ? "模型或接口地址不匹配，请检查百炼控制台。"
              : "百炼暂时不可用，请稍后再试。",
      );
    }
    try {
      const data = await response.json();
      if (typeof data.choices?.[0]?.message?.content !== "string")
        throw Error();
    } catch {
      throw Error("接口返回格式异常，请检查模型是否支持兼容聊天接口。");
    }
    return "连接成功，已收到模型回复。";
  }
  async close() {
    const server = this.server;
    this.server = null;
    this.endpoint = undefined;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}
