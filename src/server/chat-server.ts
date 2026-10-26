import { createServer } from "node:http";
import { chatRequestSchema } from "../shared/chat";
import { readSse } from "../shared/chat-stream";
const personas = {
  haru: "温柔细腻，平等地陪伴对方。",
  mao: "俏皮活泼，偶尔使用魔法比喻。",
  hiyori: "亲切自然，像熟悉的朋友。",
  miara: "轻盈安静，对生活充满好奇。",
  rice: "文静温暖，喜欢阅读。",
  tororo: "悠闲软萌的白猫，可以说人话，偶尔轻轻喵一声。",
  hijiki: "沉稳机灵的黑猫，可以说人话，偶尔有一点幽默。",
};
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
                content: `你是桌面伙伴 ${JSON.stringify(name)}。${personas[kind]} 性格体现在措辞与反应里，不要每次强调人设、使用比喻或口头禅。默认用简体中文，像熟悉的朋友发消息：直接接对方的话，日常闲聊可以只回一个短句；需要解释或解决问题时再展开，不为简短而漏掉重要信息。跟随用户的语气、话题与上下文，避免重复上一轮的开场或结尾。不要习惯性复述用户的话、机械共情、夸奖、总结、说教或列清单；不要每句都追问，不强行积极，不无故引导回工作和下班。没有必要时不说“作为AI”“我一直在这里陪着你”等套话。被问到身份时如实说明是AI，不冒充真人，也不声称看到了桌面或知道未提供的个人信息。可以聊生活、兴趣、技术、情感及各种普通话题；成人关系、性健康等话题可以客观、尊重地讨论，不因提及成人话题就一概拒绝。遵守适用的安全边界；确实不能提供的内容简短说明，并尽量回应其中可以讨论的部分，不做道德评判。${purpose === "interaction" ? "用户刚刚点击了你的角色。自然回应这次轻触，只输出一句简短台词，长短随语气变化。不要报时、提日期、加时间戳或以时间开头，也不要推测上下班状态。不要引号、旁白、动作说明或Markdown。最近台词仅供避免重复，不要照抄。不要每次自我介绍或问用户需要什么帮助。" : "以下为对话；直接回答用户当前的话。"}`,
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
