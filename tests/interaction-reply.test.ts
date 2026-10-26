import { test, expect, vi } from "vitest";
import { InteractionReply } from "../src/main/interaction-reply";
test("click replies use character identity and separate recent lines without chat history", async () => {
  const bodies: any[] = [],
    publish = vi.fn();
  const reply = new InteractionReply(
    async (body, _signal, delta) => {
      bodies.push(body);
      delta(body.kind === "mao" ? "魔法准备好啦！" : "今天也一起慢慢来吧。");
    },
    publish,
    async () => {},
  );
  await reply.request("mao", "小猫");
  await reply.request("mao", "小猫");
  await reply.request("haru", "小晴");
  expect(bodies[0]).toMatchObject({
    kind: "mao",
    name: "小猫",
    purpose: "interaction",
  });
  expect(bodies[0].messages[0].content).not.toContain("当前本地时间");
  expect(bodies[0].messages[0].content).not.toMatch(/\d{1,2}:\d{2}/);
  expect(bodies[1].messages[0].content).toContain("魔法准备好啦");
  expect(bodies[2].messages[0].content).not.toContain("魔法准备好啦");
  expect(publish).toHaveBeenCalledTimes(3);
});
test("clicks coalesce while waiting and cancel discards stale replies", async () => {
  let release!: () => void;
  const ready = new Promise<void>((r) => (release = r)),
    publish = vi.fn(),
    transport = vi.fn();
  const reply = new InteractionReply(transport, publish, () => ready);
  const pending = reply.request("haru", "Haru");
  await reply.request("mao", "Mao");
  reply.cancel();
  release();
  await pending;
  expect(transport).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});
test("late transport results are ignored after cancellation and failure is explicit", async () => {
  let finish!: () => void;
  const publish = vi.fn();
  const reply = new InteractionReply(
    async (_body, _signal, delta) => {
      await new Promise<void>((r) => (finish = r));
      delta("旧角色回复");
    },
    publish,
    async () => {},
  );
  const pending = reply.request("haru", "Haru");
  await Promise.resolve();
  reply.cancel();
  finish();
  await pending;
  expect(publish).not.toHaveBeenCalled();
  const failed = new InteractionReply(
    async () => {
      throw Error("private detail");
    },
    publish,
    async () => {},
  );
  await failed.request("mao", "Mao");
  expect(publish).toHaveBeenCalledWith(
    expect.stringContaining("AI 互动暂时不可用"),
  );
  expect(JSON.stringify(publish.mock.calls)).not.toContain("private detail");
});
