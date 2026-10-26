import { expect, test } from "vitest";
import { emptyNarrative } from "../src/shared/narrative";
import { remember, forgetMemory, recallMemories } from "../src/core/memory";
const source = (id: string, content: string, role = "user") => ({ id, content, role, status: "complete", at: 1 });
const candidate = (sourceId: string, quote: string, topic = "饮品") => ({ sourceId, quote, topic, category: "preference" as const });
test("remembered facts require exact user evidence and reject assistant, third-party and hypothetical claims", () => {
  const s = emptyNarrative();
  const sources = [source("a", "我不喝咖啡"), source("b", "朋友不喝咖啡"), source("c", "如果我养猫"), source("d", "你很孤独", "assistant")];
  expect(remember(s, "haru", candidate("a", "我不喝咖啡"), sources)).toBe(true);
  for (const [id, quote] of [["b", "朋友不喝咖啡"], ["c", "如果我养猫"], ["d", "你很孤独"], ["a", "我喜欢喝咖啡"]])
    expect(remember(s, "haru", candidate(id, quote), sources)).toBe(false);
  expect(recallMemories(s, "haru", "想喝点咖啡")[0].text).toBe("我不喝咖啡");
  expect(recallMemories(s, "mao", "咖啡")).toEqual([]);
});
test("explicit correction replaces the old fact; forget suppresses source and derived messages", () => {
  const s = emptyNarrative();
  const a = source("a", "我喜欢咖啡"), b = source("b", "更正一下，我现在不喝咖啡，改喝茶了");
  remember(s, "haru", candidate("a", a.content), [a]);
  remember(s, "haru", candidate("b", b.content), [b]);
  const remembered = recallMemories(s, "haru", "喝什么");
  expect(remembered).toHaveLength(1);
  expect(remembered[0].text).toContain("改喝茶");
  forgetMemory(s, "haru", remembered[0].id, ["answer-b"]);
  expect(s.excluded.haru).toEqual(expect.arrayContaining(["a", "b", "answer-b"]));
  expect(remember(s, "haru", candidate("b", b.content), [b])).toBe(false);
  expect(recallMemories(s, "haru", "茶")).toEqual([]);
});
test("secrets and unrequested sensitive details are not stored, and recall is relevant and bounded", () => {
  const s = emptyNarrative();
  for (const text of ["我的密码是abc123", "我的验证码是123456", "我患有抑郁症", "我的精确住址是中山路1号"])
    expect(remember(s, "haru", candidate(text, text), [source(text, text)])).toBe(false);
  for (let i = 0; i < 12; i++) {
    const text = `我喜欢第${i}种水果`;
    remember(s, "haru", candidate(String(i), text, `水果${i}`), [source(String(i), text)]);
  }
  expect(recallMemories(s, "haru", "水果")).toHaveLength(8);
  expect(recallMemories(s, "haru", "编程代码")).toHaveLength(0);
});
