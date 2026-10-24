import type { chatTransport } from "./chat-controller";
import type { Live2dKind } from "../shared/characters";

/** Ephemeral click replies never become user messages or persisted chat history. */
export class InteractionReply {
  private current: AbortController | null = null;
  private recent = new Map<Live2dKind, string[]>();
  constructor(
    private transport: typeof chatTransport,
    private publish: (text: string) => void,
    private ready: () => Promise<void>,
  ) {}
  cancel() {
    this.current?.abort();
    this.current = null;
  }
  async request(kind: Live2dKind, name: string) {
    if (this.current) return;
    const abort = new AbortController();
    this.current = abort;
    try {
      await this.ready();
      if (abort.signal.aborted) return;
      const recent = this.recent.get(kind) ?? [];
      let content = "";
      await this.transport(
        {
          kind,
          name,
          purpose: "interaction",
          messages: [
            {
              role: "user",
              content: `我轻轻点了你一下，回应我吧。当前本地时间：${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}。最近说过的台词（仅供避免重复）：${JSON.stringify(recent)}`,
            },
          ],
        },
        AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
        (text) => {
          content += text;
          if (content.length > 1000) throw Error("回复过长");
        },
      );
      if (abort.signal.aborted) return;
      content = content.trim();
      if (!content) throw Error("空回复");
      this.recent.set(kind, [...recent, content].slice(-5));
      this.publish(content);
    } catch {
      if (!abort.signal.aborted)
        this.publish(
          "AI 互动暂时不可用，请检查伙伴聊天中的 AI 设置，稍后再试。",
        );
    } finally {
      if (this.current === abort) this.current = null;
    }
  }
}
