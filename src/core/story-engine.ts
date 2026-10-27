import { characterOrder, type Live2dKind } from "../shared/characters";
import { storyCatalog, type StoryChoice } from "../shared/story-catalog";
import {
  type ArcId,
  type NarrativeState,
  type StoryWorld,
  type StoryEvent,
  type Evidence,
} from "../shared/narrative";

export function createWorld(state: NarrativeState, name = "零号站 · 初次相遇") {
  if (state.worlds.length >= 20)
    throw Error("已保留 20 个故事存档，请先管理旧存档。");
  const world: StoryWorld = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || "零号站",
    createdAt: Date.now(),
    contentVersion: 1,
    revision: 0,
    archived: false,
    tracks: {},
    activeArc: null,
    paused: true,
    events: [],
    evidence: [],
    flags: [],
    messages: [],
  };
  state.worlds.push(world);
  state.selectedWorldId = world.id;
  return world;
}
function check(world: StoryWorld, revision: number) {
  if (world.archived) throw Error("请先恢复这个已归档的故事。");
  if (world.revision !== revision)
    throw Error("故事已经变化，请查看最新场景后再选择。");
}
function flagFamily(flag: string) {
  if (flag.startsWith("joint.supply-")) return "joint.supply-";
  if (flag.startsWith("joint.blackout-")) return "joint.blackout-";
  if (["joint.open-process", "joint.curated"].includes(flag)) return "hearing";
  if (["joint.review", "joint.delegated"].includes(flag)) return "terms";
  return flag;
}
function applyEvent(world: StoryWorld, event: StoryEvent) {
  if (event.shareId) {
    const e = world.evidence.find((e) => e.id === event.shareId);
    if (e) {
      e.knownBy = [...new Set([...e.knownBy, ...event.audience])];
      if (event.audience.length === 7) e.public = true;
    }
  } else world.tracks[event.arc] = event.to;
  for (const g of event.grants)
    if (!world.evidence.some((e) => e.id === g.id))
      world.evidence.push(structuredClone(g));
  for (const f of event.flags) {
    world.flags = world.flags.filter(
      (old) => flagFamily(old) !== flagFamily(f),
    );
    world.flags.push(f);
  }
  world.events.push(event);
  world.revision++;
  world.activeArc = event.arc;
  world.paused = false;
}
export function enterStory(
  world: StoryWorld,
  arc: ArcId,
  actor: Live2dKind,
  revision: number,
) {
  check(world, revision);
  if (arc !== "joint" && arc !== actor)
    throw Error("请先切换到这条故事的角色。");
  if (arc === "joint" && new Set(world.evidence.map((e) => e.owner)).size < 2)
    throw Error("先探索至少两位角色，取得可分享的线索，再参加联合听证。");
  if (!world.tracks[arc])
    applyEvent(world, {
      id: crypto.randomUUID(),
      opId: crypto.randomUUID(),
      at: Date.now(),
      arc,
      from: "start",
      to: "start",
      choice: "@enter",
      text: storyCatalog[arc].nodes.start.text,
      flags: [],
      grants: [],
      audience: arc === "joint" ? [...characterOrder] : [actor],
    });
  else {
    world.activeArc = arc;
    world.paused = false;
    world.revision++;
  }
}
export function availableChoices(world: StoryWorld, arc: ArcId): StoryChoice[] {
  const node = storyCatalog[arc].nodes[world.tracks[arc] ?? "start"];
  return (node?.choices ?? []).filter(
    (c) =>
      (c.requires ?? []).every((f) => world.flags.includes(f)) &&
      (!c.any || c.any.some((f) => world.flags.includes(f))) &&
      (c.evidence ?? []).every((id) =>
        world.evidence.some(
          (e) => e.id === id && e.public && e.type === "confirmed",
        ),
      ),
  );
}
export function chooseStory(
  world: StoryWorld,
  arc: ArcId,
  choiceId: string,
  actor: Live2dKind,
  revision: number,
  opId: string,
) {
  const duplicate = world.events.find((e) => e.opId === opId);
  if (duplicate) {
    if (duplicate.arc !== arc || duplicate.choice !== choiceId)
      throw Error("操作标识已经用于另一个选择。");
    return;
  }
  check(world, revision);
  if (
    world.paused ||
    world.activeArc !== arc ||
    (arc !== "joint" && arc !== actor)
  )
    throw Error("请先进入当前角色的对应故事。");
  const choice = availableChoices(world, arc).find((c) => c.id === choiceId);
  if (!choice) throw Error("当前场景不能采取这个行动，所需条件可能尚未满足。");
  if (world.events.length >= 2000)
    throw Error("这个故事的记录已满，请保留存档并开始新的故事。");
  const id = crypto.randomUUID(),
    audience = choice.public ? [...characterOrder] : [actor];
  applyEvent(world, {
    id,
    opId,
    at: Date.now(),
    arc,
    from: world.tracks[arc],
    to: choice.to,
    choice: choice.id,
    text: choice.result,
    flags: choice.flags ?? [],
    audience,
    grants: (choice.grants ?? []).map((g) => ({
      ...g,
      knownBy: [g.owner],
      public: false,
      eventId: id,
    })),
  });
}
export function shareEvidence(
  world: StoryWorld,
  evidenceId: string,
  audience: Live2dKind[],
  revision: number,
  opId: string,
) {
  if (world.events.some((e) => e.opId === opId)) return;
  check(world, revision);
  const e = world.evidence.find((e) => e.id === evidenceId);
  if (!e) throw Error("没有取得这份证据。");
  const unique = [...new Set(audience)];
  if (!unique.length || unique.some((k) => !characterOrder.includes(k)))
    throw Error("请选择要展示给谁。");
  if (!canShareEvidence(e, unique))
    throw Error("这份材料仅允许有限查验，累计最多展示给两位其他角色。");
  const arc = world.activeArc ?? e.owner;
  const beforePaused = world.paused,
    beforeArc = world.activeArc;
  applyEvent(world, {
    id: crypto.randomUUID(),
    opId,
    at: Date.now(),
    arc,
    from: world.tracks[arc] ?? "start",
    to: world.tracks[arc] ?? "start",
    choice: "@share",
    text: `展示了「${e.title}」，引用边界仍有效。`,
    flags: [],
    grants: [],
    audience: unique,
    shareId: e.id,
  });
  world.paused = beforePaused;
  world.activeArc = beforeArc;
}
export function canShareEvidence(evidence: Evidence, audience: Live2dKind[]) {
  if (evidence.sharePolicy === "private") return false;
  const readers = new Set(
    [...evidence.knownBy, ...audience].filter((k) => k !== evidence.owner),
  );
  return evidence.sharePolicy !== "limited" || readers.size <= 2;
}
export function forkWorld(
  state: NarrativeState,
  worldId: string,
  beforeEventId: string,
) {
  const source = state.worlds.find((w) => w.id === worldId);
  if (!source) throw Error("存档不存在。");
  const cut = source.events.findIndex((e) => e.id === beforeEventId);
  if (cut < 0) throw Error("分歧点不存在。");
  const world = createWorld(
    state,
    (source.name + " · 另一种选择").slice(0, 60),
  );
  for (const event of source.events.slice(0, cut))
    applyEvent(world, structuredClone(event));
  world.messages = source.messages
    .filter((m) => (m.eventIndex ?? Infinity) <= cut)
    .map((m) => ({ ...structuredClone(m), worldId: world.id }));
  world.activeArc = source.events[cut].arc;
  world.paused = false;
  return world;
}
export function storyContext(world: StoryWorld | undefined, actor: Live2dKind) {
  if (!world) return "";
  const known = world.evidence.filter((e) => e.knownBy.includes(actor));
  const events = world.events
    .filter((e) => e.audience.includes(actor) && e.choice !== "@enter")
    .slice(-8);
  const arc = world.activeArc,
    node = arc ? storyCatalog[arc].nodes[world.tracks[arc]] : undefined;
  const active = !world.paused && (arc === "joint" || arc === actor);
  return [
    `世界存档：${JSON.stringify(world.name)}。${active ? "正在参与虚构故事" : "当前是日常聊天，以下仅是已发生的故事背景；不要主动推进"}。`,
    world.flags.includes("miara.departed")
      ? "Miara 已离城，只能经通信窗口联系，不能出现在现场。"
      : "",
    active && node
      ? `当前场景：${node.title}。${node.text}\n可提议的行动：${availableChoices(
          world,
          arc!,
        )
          .map((c) => c.label)
          .join("；")}。未提交的行动不可说成已发生。`
      : "",
    `你确知或听说的材料（类型必须区分）：${JSON.stringify(known.map((e) => ({ title: e.title, type: e.type, text: e.text })))}`,
    `你知情的已保存事件：${JSON.stringify(events.map((e) => e.text))}`,
    "其他角色的秘密未列出即未获得。故事对白不能改写既定历史或保存新事件；用户提出做法不等于你同意。",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}

/** Reconstruct authored state before trusting a persisted/ imported world. */
export function validateWorld(world: StoryWorld) {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, v]) => [key, stable(v)]),
          )
        : value;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  const rebuilt: StoryWorld = {
    ...world,
    tracks: {},
    events: [],
    evidence: [],
    flags: [],
    messages: [],
    revision: 0,
    activeArc: null,
    paused: true,
  };
  const seen = new Set<string>(),
    operations = new Set<string>();
  for (const e of world.events) {
    if (seen.has(e.id) || operations.has(e.opId)) throw Error("故事事件重复");
    seen.add(e.id);
    operations.add(e.opId);
    let expected: StoryEvent;
    if (e.choice === "@enter") {
      if (
        rebuilt.tracks[e.arc] ||
        (e.arc === "joint" &&
          new Set(rebuilt.evidence.map((v) => v.owner)).size < 2)
      )
        throw Error("故事入口无效");
      expected = {
        ...e,
        from: "start",
        to: "start",
        text: storyCatalog[e.arc].nodes.start.text,
        flags: [],
        grants: [],
        audience: e.arc === "joint" ? [...characterOrder] : [e.arc],
      };
    } else if (e.choice === "@share") {
      const evidence = rebuilt.evidence.find((v) => v.id === e.shareId);
      if (
        !evidence ||
        !e.audience.length ||
        new Set(e.audience).size !== e.audience.length ||
        !canShareEvidence(evidence, e.audience)
      )
        throw Error("证据分享记录无效");
      expected = {
        ...e,
        from: rebuilt.tracks[e.arc] ?? "start",
        to: rebuilt.tracks[e.arc] ?? "start",
        text: `展示了「${evidence.title}」，引用边界仍有效。`,
        flags: [],
        grants: [],
      };
    } else {
      if (!rebuilt.tracks[e.arc]) throw Error("缺少剧情入口");
      const c = availableChoices(rebuilt, e.arc).find((c) => c.id === e.choice);
      if (!c || e.shareId) throw Error("剧情选择无效");
      expected = {
        ...e,
        from: rebuilt.tracks[e.arc],
        to: c.to,
        text: c.result,
        flags: c.flags ?? [],
        audience: c.public
          ? [...characterOrder]
          : e.arc === "joint"
            ? e.audience
            : [e.arc],
        grants: (c.grants ?? []).map((g) => ({
          ...g,
          knownBy: [g.owner],
          public: false,
          eventId: e.id,
        })),
      };
    }
    if (!same(expected, e)) throw Error("剧情记录与已发布内容不一致");
    applyEvent(rebuilt, e);
  }
  if (
    !same(rebuilt.tracks, world.tracks) ||
    !same(rebuilt.flags, world.flags) ||
    !same(rebuilt.evidence, world.evidence)
  )
    throw Error("故事状态与事件不一致");
  if (world.activeArc && !world.tracks[world.activeArc])
    throw Error("当前故事不存在");
}
