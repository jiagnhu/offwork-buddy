import { expect, test, vi } from "vitest";
import { ChatController } from "../src/main/chat-controller";
import { emptyChat } from "../src/shared/chat";
import type { NarrativeAction } from "../src/shared/narrative";
function make(save = async (_s: unknown) => {}) {
  const requests: any[] = [];
  const c = new ChatController(
    emptyChat(),
    save,
    () => {},
    async (body, _signal, delta) => {
      requests.push(body);
      delta(
        body.purpose === "memory"
          ? '{"memories":[]}'
          : body.purpose === "intent"
            ? '{"choiceId":null}'
            : "继续聊。",
      );
    },
  );
  return { c, requests };
}
const action = (
  c: ChatController,
  type: NarrativeAction["type"],
  rest: Partial<NarrativeAction> = {},
) => ({
  type,
  opId: crypto.randomUUID(),
  revision: c.get().narrative.revision,
  ...rest,
});
test("explicit memory is durable beyond context, isolated by character and actually forgotten", async () => {
  const { c, requests } = make();
  await c.send("haru", "Haru", "记住我不喝咖啡");
  await c.idle();
  expect(c.get().narrative.memories.haru).toHaveLength(1);
  for (let i = 0; i < 22; i++) {
    await c.send("haru", "Haru", `话题${i}`);
    await c.idle();
  }
  await c.send("haru", "Haru", "想喝咖啡吗");
  await c.idle();
  expect(requests.at(-1).context.memories[0].text).toContain("不喝咖啡");
  await c.send("mao", "Mao", "咖啡");
  await c.idle();
  expect(requests.at(-1).context.memories).toEqual([]);
  await c.send("haru", "Haru", "忘记咖啡");
  await c.idle();
  expect(c.get().narrative.memories.haru).toHaveLength(0);
  await c.send("haru", "Haru", "饮料");
  await c.idle();
  expect(JSON.stringify(requests.at(-1).messages)).not.toContain("不喝咖啡");
  await c.flush();
});
test("story actions persist once, switching and pausing preserve the world but isolate other routes", async () => {
  const { c } = make();
  await c.narrativeAction("haru", action(c, "create"));
  const id = c.get().narrative.selectedWorldId!;
  await c.narrativeAction(
    "haru",
    action(c, "enter", { worldId: id, arc: "haru" }),
  );
  const choose = action(c, "choose", {
    worldId: id,
    arc: "haru",
    choiceId: "inspect",
  });
  await c.narrativeAction("haru", choose);
  await c.narrativeAction("haru", choose);
  expect(
    c.get().narrative.worlds[0].events.filter((e) => e.choice === "inspect"),
  ).toHaveLength(1);
  await c.send("haru", "Haru", "先不演了");
  await c.idle();
  expect(c.get().narrative.worlds[0].paused).toBe(true);
  expect(c.get().narrative.selectedWorldId).toBe(id);
  await c.flush();
});
test("save failure cannot acknowledge or leave an in-memory remembered fact", async () => {
  const { c, requests } = make(async () => {
    throw Error("disk");
  });
  await expect(c.send("haru", "Haru", "记住我喜欢茶")).rejects.toThrow();
  expect(c.get().narrative.memories.haru).toHaveLength(0);
  expect(requests).toHaveLength(0);
});
test("late automatic memory cannot resurrect information after clear", async () => {
  vi.useFakeTimers();
  let finish: (() => void) | undefined;
  const c = new ChatController(
    emptyChat(),
    async () => {},
    () => {},
    async (body, _signal, delta) => {
      if (body.purpose === "memory") {
        const source = JSON.parse(body.messages[0].content).sources[0];
        await new Promise<void>((r) => {
          finish = () => {
            delta(
              JSON.stringify({
                memories: [
                  {
                    sourceId: source.id,
                    quote: source.text,
                    topic: "饮品",
                    category: "preference",
                  },
                ],
              }),
            );
            r();
          };
        });
      } else delta("好的。");
    },
  );
  try {
    await c.send("haru", "Haru", "我不喝咖啡");
    await c.idle();
    await vi.advanceTimersByTimeAsync(4001);
    expect(finish).toBeTypeOf("function");
    await c.narrativeAction("haru", action(c, "clearMemory"));
    finish!();
    await c.flush();
    expect(c.get().narrative.memories.haru).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});
test("changing world excludes prior world chat and clearing role history removes story dialogue but not events", async () => {
  const { c, requests } = make();
  await c.narrativeAction("haru", action(c, "create"));
  const id = c.get().narrative.selectedWorldId!;
  await c.send("haru", "Haru", "只属于甲路线的句子");
  await c.idle();
  await c.narrativeAction(
    "haru",
    action(c, "enter", { worldId: id, arc: "haru" }),
  );
  await c.send("haru", "Haru", "问问旧桥");
  await c.idle();
  expect(c.get().narrative.worlds[0].messages.length).toBeGreaterThan(0);
  await c.narrativeAction("haru", action(c, "create"));
  await c.send("haru", "Haru", "你好");
  await c.idle();
  expect(JSON.stringify(requests.at(-1).messages)).not.toContain(
    "只属于甲路线",
  );
  await c.clear("haru");
  expect(c.get().narrative.worlds[0].messages).toHaveLength(0);
  expect(c.get().narrative.worlds[0].events.length).toBeGreaterThan(0);
  await c.flush();
});
test("stale actor UI cannot clear another character memory", async () => {
  const { c } = make();
  await c.send("mao", "Mao", "记住我喜欢茶");
  await expect(
    c.narrativeAction("mao", action(c, "clearMemory", { actor: "haru" })),
  ).rejects.toThrow("伙伴");
  expect(c.get().narrative.memories.mao).toHaveLength(1);
  await c.flush();
});
