import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  contextMessages,
  type ChatState,
  type ChatMessage,
} from "../shared/chat";
import {
  narrativeActionSchema,
  selectedWorld,
  type NarrativeAction,
  type NarrativeContext,
  type StoryWorld,
} from "../shared/narrative";
import { characterOrder, type Live2dKind } from "../shared/characters";
import { storyCatalog } from "../shared/story-catalog";
import {
  availableChoices,
  chooseStory,
  createWorld,
  enterStory,
  forkWorld,
  shareEvidence,
  storyContext,
} from "../core/story-engine";
import {
  explicitRemember,
  forgetMemory,
  recallMemories,
  remember,
} from "../core/memory";
import { extractMemories, suggestChoice } from "./narrative-ai";
import { chatTransport, type Transport } from "./chat-controller";

export class ChatController {
  private queue: Promise<unknown> = Promise.resolve();
  private run: Promise<void> = Promise.resolve();
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private memoryTimer: ReturnType<typeof setTimeout> | undefined;
  private memoryAbort: AbortController | null = null;
  private memoryRun: Promise<void> = Promise.resolve();
  private epoch = 0;
  constructor(
    private state: ChatState,
    private save: (s: ChatState) => Promise<void>,
    private publish: (s: ChatState) => void,
    private transport: Transport = chatTransport,
  ) {}
  get() {
    return structuredClone(this.state);
  }
  clickContext(kind: Live2dKind): NarrativeContext {
    const query =
      this.state.sessions[kind]
        .filter(
          (m) =>
            m.role === "user" &&
            !m.arc &&
            !m.local &&
            !this.state.narrative.excluded[kind].includes(m.id),
        )
        .at(-1)?.content ?? "";
    return {
      memories: recallMemories(this.state.narrative, kind, query, true).map(
        (m) => ({ text: m.text, at: m.at, category: m.category }),
      ),
    };
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
      throw Error("聊天和记忆保存失败，请检查磁盘空间和权限。");
    }
  }
  private async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const before = this.get();
    try {
      return await fn();
    } catch (e) {
      this.state = before;
      this.emit();
      throw e;
    }
  }
  private cancelMemory() {
    this.epoch++;
    if (this.memoryTimer) clearTimeout(this.memoryTimer);
    this.memoryTimer = undefined;
    this.memoryAbort?.abort();
    this.memoryAbort = null;
  }
  private append(kind: Live2dKind, message: ChatMessage, world?: StoryWorld) {
    this.state.sessions[kind].push(message);
    this.state.sessions[kind] = this.state.sessions[kind].slice(-500);
    if (world) {
      world.messages.push(message);
      world.messages = world.messages.slice(-1500);
    }
  }
  private metadata(kind: Live2dKind) {
    const world = selectedWorld(this.state.narrative);
    const inStory =
      world &&
      !world.paused &&
      (world.activeArc === kind || world.activeArc === "joint");
    return {
      world: inStory ? world : undefined,
      meta: {
        actor: kind,
        worldId: world?.id ?? null,
        ...(inStory
          ? { arc: world.activeArc!, eventIndex: world.events.length }
          : {}),
      },
    };
  }
  private async local(kind: Live2dKind, text: string) {
    const { world, meta } = this.metadata(kind);
    this.append(
      kind,
      {
        id: randomUUID(),
        role: "assistant",
        content: text,
        at: Date.now(),
        status: "complete",
        local: true,
        ...meta,
      },
      world,
    );
    await this.persist();
    this.emit();
    return this.get();
  }
  private derived(kind: Live2dKind, ids: string[]) {
    // Suppress all known continuations after the source: an old assistant may have paraphrased it.
    const list = this.state.sessions[kind],
      sources = this.state.narrative.memories[kind]
        .filter((m) => ids.includes(m.id))
        .map((m) => m.sourceId);
    const first = list.findIndex((m) => sources.includes(m.id));
    return list
      .filter(
        (m, i) =>
          (first >= 0 && i >= first) ||
          (m.memoryIds ?? []).some((id) => ids.includes(id)),
      )
      .map((m) => m.id);
  }
  send(kind: Live2dKind, name: string, text: string) {
    this.cancelMemory();
    return this.serial(() =>
      this.transaction(async () => {
        const content = z.string().trim().min(1).max(2000).parse(text);
        if (this.state.active) throw Error("请先停止当前回复。");
        delete this.state.offer;
        const n = this.state.narrative;
        let world = selectedWorld(n);
        if (
          /^(先不演了|不演了|暂停(故事|剧情)|先聊别的|换个话题|退出(剧情|故事))/.test(
            content,
          )
        ) {
          if (world) {
            world.paused = true;
            world.revision++;
            n.revision++;
          }
          this.append(kind, {
            id: randomUUID(),
            role: "user",
            content,
            at: Date.now(),
            status: "complete",
            local: true,
            actor: kind,
            worldId: world?.id ?? null,
          });
          return this.local(kind, "故事已停在这里，我们聊别的。");
        }
        const inStory =
          world &&
          !world.paused &&
          (world.activeArc === kind || world.activeArc === "joint");
        const user: ChatMessage = {
          id: randomUUID(),
          role: "user",
          content,
          at: Date.now(),
          status: "complete",
          ...this.metadata(kind).meta,
        };
        this.append(kind, user, inStory ? world : undefined);
        if (!inStory && explicitRemember(content)) {
          const quote = content.replace(
            /^(请)?(帮我)?(记住|记一下|记得)[：:，,\s]*/,
            "",
          );
          const topic = /咖啡|茶|饮料|喝/.test(quote)
            ? "饮品"
            : /叫我|名字|称呼/.test(quote)
              ? "称呼"
              : quote.slice(0, 24);
          const ok = remember(
            n,
            kind,
            {
              sourceId: user.id,
              quote,
              topic,
              category: /目标|打算|计划/.test(quote) ? "goal" : "preference",
            },
            [user],
          );
          n.processed[kind].push(user.id);
          n.revision++;
          return this.local(
            kind,
            ok
              ? "已记下。这条记忆可以在「故事与记忆」里查看或删除。"
              : "这次没有新增记忆：可能已经记过，或内容不适合长期保存。可以换成一条明确的自身喜好或目标。",
          );
        }
        if (
          !inStory &&
          /^(请)?(忘记|忘掉|别再记)(这件事|关于|我)?/.test(content)
        ) {
          user.local = true;
          const query = content.replace(
            /^(请)?(忘记|忘掉|别再记)(这件事|关于)?[：:，,\s]*/,
            "",
          );
          const all = /^(所有|全部)(的)?(记忆|事情)?$/.test(query);
          const found = all
            ? n.memories[kind]
            : recallMemories(n, kind, query).filter(
                (m) =>
                  m.text.includes(query) ||
                  query.includes(m.text) ||
                  query.replace(/^我/, "").length >= 2,
              );
          if (!all && found.length !== 1)
            return this.local(
              kind,
              found.length
                ? "找到不止一条相关记忆。请在「故事与记忆」里选出要忘掉的那条。"
                : "没有找到明确对应的长期记忆。可以告诉我是哪件事，或打开「故事与记忆」查看。",
            );
          for (const memory of [...found])
            if (n.memories[kind].some((m) => m.id === memory.id))
              forgetMemory(n, kind, memory.id, this.derived(kind, [memory.id]));
          n.revision++;
          return this.local(
            kind,
            all
              ? "已清空这个角色的长期记忆。"
              : "已删除这条记忆，关联原话不会再用于后续回复。",
          );
        }
        const invitation = storyCatalog[kind].invitation;
        const inviteWords: Record<Live2dKind, RegExp> = {
          haru: /旧桥|站务单/,
          mao: /录音|排练厅/,
          hiyori: /维修口令|工单/,
          miara: /新叶|根系|风庭/,
          rice: /演算|总账/,
          tororo: /印章|坐垫/,
          hijiki: /回信|交接凭据/,
        };
        if (
          !inStory &&
          (content === invitation ||
            /^(开始|进入|继续)(你的|这段|上次的)?(故事|剧情)/.test(content) ||
            (/^(我)?(陪你|和你一起|我们一起|带我)/.test(content) &&
              inviteWords[kind].test(content)))
        ) {
          world ??= createWorld(n);
          enterStory(world, kind, kind, world.revision);
          n.revision++;
          // The invitation is a story message, not an autobiographical user fact.
          user.worldId = world.id;
          user.arc = kind;
          user.eventIndex = world.events.length;
          world.messages.push(user);
        } else if (inStory && world) {
          const choice = availableChoices(world, world.activeArc!).find(
            (c) => c.label === content,
          );
          if (choice) {
            chooseStory(
              world,
              world.activeArc!,
              choice.id,
              kind,
              world.revision,
              user.id,
            );
            n.revision++;
          }
        }
        return this.begin(kind, name);
      }),
    );
  }
  retry(kind: Live2dKind, name: string) {
    this.cancelMemory();
    return this.serial(() =>
      this.transaction(async () => {
        if (this.state.active) throw Error("请先停止当前回复。");
        const list = this.state.sessions[kind],
          last = list.at(-1);
        if (
          !last ||
          last.role !== "assistant" ||
          !["error", "stopped"].includes(last.status)
        )
          throw Error("没有可重试的回复。");
        const world = selectedWorld(this.state.narrative);
        if (last.worldId && last.worldId !== world?.id)
          throw Error("请先回到这条回复所属的故事存档。");
        list.pop();
        if (last.arc && world)
          world.messages = world.messages.filter((m) => m.id !== last.id);
        return this.begin(kind, name, true);
      }),
    );
  }
  private async begin(kind: Live2dKind, name: string, retry = false) {
    const { world, meta } = this.metadata(kind),
      n = this.state.narrative,
      selected = selectedWorld(n);
    const source = world
      ? world.messages.filter((m) => m.actor === kind)
      : this.state.sessions[kind].filter((m) => !m.arc);
    const eligible = source.filter(
      (m) =>
        !m.local &&
        !n.excluded[kind].includes(m.id) &&
        (!m.worldId || m.worldId === selected?.id),
    );
    const messages = contextMessages(eligible),
      user = eligible.filter((m) => m.role === "user").at(-1);
    if (!messages.length) throw Error("没有可回复的内容。");
    const memories = recallMemories(n, kind, user?.content ?? "");
    const context: NarrativeContext = {
      memories: memories.map((m) => ({
        text: m.text,
        at: m.at,
        category: m.category,
      })),
      story: storyContext(selected, kind),
    };
    const assistant: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: "",
      at: Date.now(),
      status: "streaming",
      memoryIds: memories.map((m) => m.id),
      ...meta,
    };
    this.append(kind, assistant, world);
    this.state.active = { kind, id: assistant.id };
    await this.persist();
    this.emit();
    const abort = new AbortController();
    this.abort = abort;
    const current = () =>
      this.state.active?.id === assistant.id && !abort.signal.aborted;
    this.run = (async () => {
      let error: string | undefined;
      try {
        if (
          world &&
          !retry &&
          user &&
          !world.events.some((e) => e.opId === user.id)
        ) {
          try {
            const choice = await suggestChoice(
              this.transport,
              kind,
              name,
              user.content,
              availableChoices(world, world.activeArc!),
              abort.signal,
            );
            if (choice && current()) {
              this.state.offer = {
                kind,
                arc: world.activeArc!,
                worldId: world.id,
                choiceId: choice.id,
                revision: n.revision,
                label: choice.label,
              };
              assistant.content = `你是想「${choice.label}」吗？确认后才会写入故事。`;
              assistant.local = true;
            }
          } catch {
            /* A failed classifier cannot invent or commit an action. */
          }
        }
        if (!current()) return;
        if (!assistant.content)
          await this.transport(
            { kind, name, messages, context },
            abort.signal,
            (text) => {
              if (!current()) return;
              if (assistant.content.length + text.length > 16000)
                throw Error("回复超过长度限制，请重试。");
              assistant.content += text;
              if (!this.timer) this.timer = setTimeout(() => this.emit(), 40);
            },
          );
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
        try {
          await this.persist();
        } catch (e) {
          this.state.notice = (e as Error).message;
        }
        this.emit();
        if (!error && !world) this.scheduleMemory(kind, name);
      });
    })();
    return this.get();
  }
  private scheduleMemory(kind: Live2dKind, name: string, manual = false) {
    if (!manual && !this.state.narrative.autoMemory) return;
    const epoch = this.epoch;
    this.memoryTimer = setTimeout(
      () => {
        this.memoryTimer = undefined;
        this.memoryRun = this.processMemory(kind, name, epoch, manual);
      },
      manual ? 0 : 4000,
    );
    this.memoryTimer.unref?.();
  }
  private async processMemory(
    kind: Live2dKind,
    name: string,
    epoch: number,
    manual: boolean,
  ) {
    if (epoch !== this.epoch || this.state.active) return;
    const n = this.state.narrative;
    let chars = 0;
    const sources = this.state.sessions[kind]
      .filter(
        (m) =>
          m.role === "user" &&
          m.status === "complete" &&
          !m.arc &&
          !m.local &&
          !n.excluded[kind].includes(m.id) &&
          (manual || !n.processed[kind].includes(m.id)),
      )
      .slice(-8)
      .filter((m) => (chars += m.content.length) <= 8000);
    if (!sources.length) return;
    const abort = new AbortController();
    this.memoryAbort = abort;
    try {
      const candidates = await extractMemories(
        this.transport,
        kind,
        name,
        sources,
        this.state.narrative,
        abort.signal,
      );
      await this.serial(() =>
        this.transaction(async () => {
          if (abort.signal.aborted || epoch !== this.epoch || this.state.active)
            return;
          let added = 0;
          for (const c of candidates)
            if (remember(this.state.narrative, kind, c, sources)) added++;
          this.state.narrative.processed[kind] = [
            ...new Set([
              ...this.state.narrative.processed[kind],
              ...sources.map((m) => m.id),
            ]),
          ].slice(-2000);
          this.state.narrative.revision++;
          this.state.memoryNotice = added
            ? `记下了 ${added} 件事，可在「故事与记忆」查看。`
            : manual
              ? "这批记录已整理，没有新增可保存的事实。"
              : undefined;
          await this.persist();
          this.emit();
        }),
      );
    } catch {
      if (!abort.signal.aborted && epoch === this.epoch && manual) {
        this.state.memoryNotice =
          "记忆整理未完成，可以稍后重试；原记录仍保留。";
        this.emit();
      }
    } finally {
      if (this.memoryAbort === abort) this.memoryAbort = null;
    }
  }
  narrativeAction(
    kind: Live2dKind,
    input: NarrativeAction,
    name = kind as string,
  ) {
    this.cancelMemory();
    return this.serial(() =>
      this.transaction(async () => {
        const a = narrativeActionSchema.parse(input),
          n = this.state.narrative;
        if (a.actor && a.actor !== kind)
          throw Error("当前伙伴已改变，请先切换到要操作的角色。");
        if (this.state.active) throw Error("请先停止当前回复。");
        const world = a.worldId
          ? n.worlds.find((w) => w.id === a.worldId)
          : selectedWorld(n);
        if (
          a.type === "choose" &&
          world?.events.some(
            (e) =>
              e.opId === a.opId && e.choice === a.choiceId && e.arc === a.arc,
          )
        )
          return this.get();
        if (a.revision !== n.revision)
          throw Error("内容已经变化，请根据最新内容重新操作。");
        if (a.worldId && !world) throw Error("这个故事存档已不存在。");
        const requireWorld = () => {
          if (!world) throw Error("请先创建故事存档。");
          return world;
        };
        const requireSelected = () => {
          const w = requireWorld();
          if (w.id !== n.selectedWorldId)
            throw Error("请先切换到这个故事存档。");
          return w;
        };
        switch (a.type) {
          case "create":
            createWorld(n, a.name);
            break;
          case "select":
            n.selectedWorldId = requireWorld().id;
            requireWorld().paused = true;
            break;
          case "enter":
            enterStory(
              requireSelected(),
              a.arc ?? kind,
              kind,
              requireSelected().revision,
            );
            break;
          case "pause":
            requireSelected().paused = true;
            requireSelected().revision++;
            break;
          case "choose": {
            const w = requireSelected();
            if (!a.arc || !a.choiceId) throw Error("缺少选择。");
            chooseStory(w, a.arc, a.choiceId, kind, w.revision, a.opId);
            const node = storyCatalog[a.arc].nodes[w.tracks[a.arc]],
              event = w.events.at(-1)!;
            this.append(
              kind,
              {
                id: randomUUID(),
                role: "assistant",
                content: `${event.text}\n\n${node.text}`,
                at: Date.now(),
                status: "complete",
                local: true,
                actor: kind,
                worldId: w.id,
                arc: a.arc,
                eventIndex: w.events.length,
              },
              w,
            );
            break;
          }
          case "share":
            shareEvidence(
              requireSelected(),
              a.evidenceId ?? "",
              a.audience ?? [],
              requireSelected().revision,
              a.opId,
            );
            break;
          case "fork":
            forkWorld(n, requireWorld().id, a.eventId ?? "");
            break;
          case "archive":
            requireWorld().archived = a.enabled ?? true;
            requireWorld().paused = true;
            break;
          case "deleteWorld": {
            const w = requireWorld();
            n.worlds = n.worlds.filter((v) => v.id !== w.id);
            if (n.selectedWorldId === w.id) n.selectedWorldId = null;
            for (const k of characterOrder)
              this.state.sessions[k] = this.state.sessions[k].filter(
                (m) => m.worldId !== w.id,
              );
            break;
          }
          case "forget":
            forgetMemory(
              n,
              kind,
              a.memoryId ?? "",
              this.derived(kind, [a.memoryId ?? ""]),
            );
            break;
          case "clearMemory": {
            n.excluded[kind] = [
              ...new Set([
                ...n.excluded[kind],
                ...this.state.sessions[kind]
                  .filter((m) => !m.arc)
                  .map((m) => m.id),
                ...n.memories[kind].map((m) => m.sourceId),
              ]),
            ];
            n.memories[kind] = [];
            break;
          }
          case "autoMemory":
            n.autoMemory = a.enabled ?? false;
            break;
          case "organize":
            this.state.memoryNotice = "正在整理最近 8 条符合条件的用户消息…";
            break;
        }
        n.revision++;
        delete this.state.offer;
        await this.persist();
        this.emit();
        if (a.type === "organize") this.scheduleMemory(kind, name, true);
        return this.get();
      }),
    );
  }
  stop() {
    this.cancelMemory();
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
        try {
          await this.persist();
        } catch (e) {
          this.state.notice = (e as Error).message;
          this.emit();
          throw e;
        }
        this.emit();
      }
      return this.get();
    });
  }
  async switchCharacter(kind: Live2dKind) {
    await this.stop();
    await this.serial(async () => {
      const w = selectedWorld(this.state.narrative);
      if (w && !w.paused) {
        w.paused = true;
        w.revision++;
        this.state.narrative.revision++;
        await this.persist();
      }
      delete this.state.offer;
      this.emit();
    });
  }
  clear(kind: Live2dKind) {
    this.cancelMemory();
    return this.serial(() =>
      this.transaction(async () => {
        if (this.state.active) throw Error("请先停止当前回复，再清空记录。");
        this.state.sessions[kind] = [];
        this.state.narrative.memories[kind] = [];
        this.state.narrative.excluded[kind] = [];
        this.state.narrative.processed[kind] = [];
        this.state.narrative.revision++;
        for (const world of this.state.narrative.worlds)
          world.messages = world.messages.filter((m) => m.actor !== kind);
        await this.persist();
        this.emit();
        return this.get();
      }),
    );
  }
  async replace(state: ChatState, persist = true) {
    await this.stop();
    await this.idle();
    await this.serial(() =>
      this.transaction(async () => {
        this.state = structuredClone(state);
        this.state.active = null;
        if (persist) await this.persist();
        this.emit();
      }),
    );
  }
  async idle() {
    await this.run;
    await this.queue;
  }
  async flush() {
    await this.stop();
    await this.idle();
    await this.memoryRun;
  }
}
