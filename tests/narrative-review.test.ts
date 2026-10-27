import { expect, test, vi } from "vitest";
import { emptyChat, type ChatState } from "../src/shared/chat";
import { remember } from "../src/core/memory";
import {
  createWorld,
  enterStory,
  chooseStory,
  shareEvidence,
  validateWorld,
} from "../src/core/story-engine";
import { ChatController } from "../src/main/chat-controller";
import { parseChat } from "../src/main/chat-store";
import type { NarrativeAction } from "../src/shared/narrative";

test("model candidates cannot strip surrounding denial or attribution from the user's assertion", async () => {
  vi.useFakeTimers();
  const c = new ChatController(
    emptyChat(),
    async () => {},
    () => {},
    async (body, _signal, delta) => {
      if (body.purpose === "memory") {
        const { sources } = JSON.parse(body.messages[0].content);
        delta(
          JSON.stringify({
            memories: sources.map((s: { id: string }) => ({
              sourceId: s.id,
              quote: "我喜欢咖啡",
              topic: "饮品",
              category: "preference",
            })),
          }),
        );
      } else delta("明白。");
    },
  );
  try {
    for (const text of [
      "我不是说我喜欢咖啡",
      "有人说我喜欢咖啡，但这不是真的",
      "我喜欢咖啡才怪",
      "我没有承认我喜欢咖啡",
    ]) {
      await c.send("haru", "Haru", text);
      await c.idle();
    }
    await vi.advanceTimersByTimeAsync(4001);
    await c.flush();
    expect(c.get().narrative.memories.haru).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

test.each(["forget", "clearMemory"] as const)(
  "%s suppresses world-only derived replies after retention and restart",
  async (type) => {
    const s = emptyChat();
    const source = {
      id: "source",
      role: "user" as const,
      content: "我喜欢咖啡",
      status: "complete" as const,
      at: 1,
    };
    remember(
      s.narrative,
      "haru",
      {
        sourceId: source.id,
        quote: source.content,
        topic: "饮品",
        category: "preference",
      },
      [source],
    );
    const memory = s.narrative.memories.haru[0],
      w = createWorld(s.narrative);
    enterStory(w, "haru", "haru", w.revision);
    w.messages.push({
      id: "world-only",
      role: "assistant",
      content: "你喜欢咖啡，我记得。",
      status: "complete",
      at: 2,
      actor: "haru",
      worldId: w.id,
      arc: "haru",
      eventIndex: w.events.length,
      memoryIds: [memory.id],
    });
    w.messages.push({
      id: "derived-followup",
      role: "assistant",
      content: "杯子里还是你最爱的那种咖啡。",
      status: "complete",
      at: 3,
      actor: "haru",
      worldId: w.id,
      arc: "haru",
      eventIndex: w.events.length,
    });
    s.sessions.haru = Array.from({ length: 500 }, (_, i) => ({
      id: `new-${i}`,
      role: "user",
      content: "新日常",
      at: 100 + i,
      status: "complete",
    }));
    let saved: ChatState = s;
    const c = new ChatController(
      s,
      async (value) => {
        saved = structuredClone(value);
      },
      () => {},
    );
    await c.narrativeAction("haru", {
      type,
      memoryId: memory.id,
      opId: "forget-op",
      revision: s.narrative.revision,
    });
    const requests: any[] = [];
    const restored = new ChatController(
      parseChat(saved),
      async () => {},
      () => {},
      async (body, _signal, delta) => {
        requests.push(body);
        delta(body.purpose === "intent" ? '{"choiceId":null}' : "继续。");
      },
    );
    await restored.send("haru", "Haru", "继续聊这个场景");
    await restored.idle();
    expect(JSON.stringify(requests.at(-1).messages)).not.toContain("咖啡");
    expect(restored.get().narrative.memories.haru).toHaveLength(0);
    await restored.flush();
  },
);

test("limited evidence permits only two additional readers cumulatively, including import replay", () => {
  const s = emptyChat(),
    w = createWorld(s.narrative);
  enterStory(w, "haru", "haru", w.revision);
  for (const id of ["talk", "witness", "continue", "limited"])
    chooseStory(w, "haru", id, "haru", w.revision, crypto.randomUUID());
  shareEvidence(w, "haru-plan", ["mao"], w.revision, "share-mao");
  shareEvidence(w, "haru-plan", ["rice"], w.revision, "share-rice");
  expect(() => validateWorld(w)).not.toThrow();
  expect(() =>
    shareEvidence(
      structuredClone(w),
      "haru-plan",
      ["miara"],
      w.revision,
      "share-miara",
    ),
  ).toThrow("两位");
  const corrupt = structuredClone(w),
    event = structuredClone(corrupt.events.at(-1)!);
  event.id = "forged-event";
  event.opId = "forged-op";
  event.audience = ["miara"];
  corrupt.events.push(event);
  corrupt.evidence.find((e) => e.id === "haru-plan")!.knownBy.push("miara");
  corrupt.revision++;
  expect(() => validateWorld(corrupt)).toThrow();
});
