import {
  memoryCandidateSchema,
  type MemoryCandidate,
  type NarrativeState,
} from "../shared/narrative";
import type { Live2dKind } from "../shared/characters";

type Source = {
  id: string;
  content: string;
  role: string;
  status: string;
  at: number;
  arc?: string;
  local?: boolean;
};
const credential =
  /密码|口令是|验证码|私钥|API.?KEY|密钥|银行卡|信用卡|身份证|护照号|支付凭证|sk-[\w-]+/i;
const sensitive =
  /住址|地址|门牌|手机号|电话号码|患有|确诊|抑郁|病史|性经历|性生活|宗教|信仰|政党|政治立场/;
const hypothetical =
  /如果|假如|假设|要是|比如|举例|剧本|扮演|故事里|剧情里|梦见|小说里|引用|他说|她说|朋友说|朋友.*[我他她]|“|「|"/;
const correction =
  /更正|纠正|改为|改喝|不再|以前.{0,30}现在|现在.{0,20}(不|改)|记错|不是.{0,30}而是/;
// A contained fragment is not necessarily the speaker's assertion. Keep sentence
// boundaries and reject metalinguistic/denied statements before trusting a quote.
function ownsAssertion(source: string, quote: string) {
  const strip = (value: string) =>
    value
      .trim()
      .replace(/^(请)?(帮我)?(记住|记一下|记得)[：:，,\s]*/, "")
      .replace(/^(更正|纠正)(一下)?[：:，,\s]*/, "");
  const full = strip(source),
    text = strip(quote);
  if (
    /不是说|没(?:有)?说|有人说|别人说|听说|传言|不是真的|开玩笑|反话|[?？]/.test(
      full,
    )
  )
    return false;
  const offset = full.indexOf(text);
  if (offset < 0) return false;
  const before = full.slice(0, offset).trimEnd(),
    after = full.slice(offset + text.length).trimStart();
  return (
    (!before || /[。！？；;\n]$/.test(before)) &&
    (!after || /^[，,。！？；;\n]/.test(after))
  );
}
export function explicitRemember(text: string) {
  return /^(请)?(帮我)?(记住|记一下|记得)[：:，,\s]*/.test(text.trim());
}
export function remember(
  state: NarrativeState,
  kind: Live2dKind,
  input: MemoryCandidate,
  sources: Source[],
): boolean {
  const parsed = memoryCandidateSchema.safeParse(input);
  if (!parsed.success) return false;
  const c = parsed.data,
    source = sources.find((s) => s.id === c.sourceId);
  if (
    !source ||
    source.role !== "user" ||
    source.status !== "complete" ||
    source.arc ||
    source.local ||
    !source.content.includes(c.quote)
  )
    return false;
  const explicit = explicitRemember(source.content),
    text = c.quote.trim();
  if (
    state.excluded[kind].includes(source.id) ||
    credential.test(source.content) ||
    (!explicit && sensitive.test(source.content))
  )
    return false;
  if (
    hypothetical.test(source.content) ||
    !ownsAssertion(source.content, text) ||
    !/^(更正一下[，,：:]?\s*)?(请)?(帮我)?(记住|记一下|记得)?[：:，,\s]*(我|本人)/.test(
      text,
    )
  )
    return false;
  if (/我(的)?(朋友|同事|同学|家人|老板|客户)/.test(text)) return false;
  const memories = state.memories[kind];
  if (memories.some((m) => m.text === text && m.status === "active"))
    return false;
  if (memories.length >= 500) return false; // Never silently evict requested memories.
  const prior = memories.filter(
    (m) => m.topic === c.topic && m.status === "active",
  );
  const replacing = correction.test(source.content);
  if (replacing)
    for (const m of prior) {
      m.status = "superseded";
      if (!state.excluded[kind].includes(m.sourceId))
        state.excluded[kind].push(m.sourceId);
    }
  memories.push({
    id: crypto.randomUUID(),
    kind,
    text,
    sourceId: source.id,
    sourceText: source.content,
    at: source.at,
    updatedAt: Date.now(),
    topic: c.topic,
    category: c.category,
    explicit,
    sensitive: sensitive.test(text),
    status: prior.length && !replacing ? "uncertain" : "active",
  });
  return true;
}
export function forgetMemory(
  state: NarrativeState,
  kind: Live2dKind,
  id: string,
  derivedIds: string[] = [],
) {
  const memory = state.memories[kind].find((m) => m.id === id);
  if (!memory) throw Error("这条记忆已不存在。");
  const related = state.memories[kind].filter(
    (m) =>
      m.id === id || (m.topic === memory.topic && m.status === "superseded"),
  );
  state.excluded[kind] = [
    ...new Set([
      ...state.excluded[kind],
      ...related.map((m) => m.sourceId),
      ...derivedIds,
    ]),
  ];
  state.memories[kind] = state.memories[kind].filter(
    (m) => !related.includes(m),
  );
}
function terms(text: string) {
  const clean = text
    .toLowerCase()
    .replace(/[我你他的了是在有想要什么怎么一下]+/g, "");
  return new Set(clean.match(/[\u4e00-\u9fff]|[a-z0-9]{2,}/g) ?? []);
}
export function recallMemories(
  state: NarrativeState,
  kind: Live2dKind,
  query: string,
  click = false,
) {
  const words = terms(query);
  const ranked = state.memories[kind]
    .filter((m) => m.status === "active" && (!click || !m.sensitive))
    .map((m) => ({
      m,
      score: [...terms(m.topic + m.text)].filter((w) => words.has(w)).length,
    }))
    .filter((v) => v.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.m.explicit) - Number(a.m.explicit) ||
        b.m.updatedAt - a.m.updatedAt,
    );
  let budget = 2400;
  return ranked
    .slice(0, click ? 2 : 8)
    .map((v) => v.m)
    .filter((m) => (budget -= m.text.length) >= 0);
}
