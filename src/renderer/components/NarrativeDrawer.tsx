import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  GitBranch,
  X,
  Trash2,
  Archive,
  Check,
  ArrowRight,
} from "lucide-react";
import {
  characterOrder,
  characterName,
  live2dModels,
  type Live2dKind,
} from "../../shared/characters";
import type { ChatState } from "../../shared/chat";
import {
  selectedWorld,
  type ArcId,
  type NarrativeAction,
} from "../../shared/narrative";
import { storyCatalog } from "../../shared/story-catalog";
import StoryScene from "./StoryScene";
import "../styles/narrative.css";
const portraits = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
export default function NarrativeDrawer({
  kind: initialKind,
  name: initialName,
  onClose,
  initialTab = "story",
}: {
  kind: Live2dKind;
  name: string;
  onClose: () => void;
  initialTab?: "story" | "known" | "memory" | "saves";
}) {
  const [kind, setKind] = useState(initialKind),
    [names, setNames] = useState<Record<string, string>>({
      [initialKind]: initialName,
    });
  const name = names[kind] ?? live2dModels[kind].name;
  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);
  useEffect(() => {
    void window.buddy
      .getSnapshot()
      .then((s) =>
        setNames(
          Object.fromEntries(
            characterOrder.map((k) => [
              k,
              characterName(k, s.state.preferences),
            ]),
          ),
        ),
      );
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const [chat, setChat] = useState<ChatState | null>(null),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [newName, setNewName] = useState("");
  const [audiences, setAudiences] = useState<Record<string, Live2dKind>>({});
  const [confirm, setConfirm] = useState<{
    text: string;
    action: () => Promise<unknown>;
  } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    let live = true,
      revision = 0;
    const off = window.buddy.onChat((s) => {
      revision++;
      if (live) setChat(s);
    });
    const start = revision;
    void window.buddy
      .getChat()
      .then((s) => {
        if (live && revision === start) setChat(s);
      })
      .catch(() => setError("读取失败，请重新打开。"));
    return () => {
      live = false;
      off();
    };
  }, []);
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  async function perform(input: NarrativeAction) {
    const next = await window.buddy.narrativeAction({
      ...input,
      actor: input.actor ?? kind,
    });
    setChat(next);
    return next;
  }
  const n = chat?.narrative,
    world = n ? selectedWorld(n) : undefined;
  const act = (
    type: NarrativeAction["type"],
    extra: Partial<NarrativeAction> = {},
  ) =>
    perform({
      type,
      revision: n!.revision,
      opId: crypto.randomUUID(),
      worldId: world?.id,
      ...extra,
    });
  async function enter(arc: ArcId) {
    let current = chat!;
    const role = arc === "joint" ? kind : arc;
    const prefs = (await window.buddy.getSnapshot()).state.preferences;
    if (prefs.character !== role) {
      await window.buddy.setPreferences({ character: role });
      current = await window.buddy.getChat();
    }
    setKind(role);
    if (!selectedWorld(current.narrative))
      current = await perform({
        type: "create",
        actor: role,
        revision: current.narrative.revision,
        opId: crypto.randomUUID(),
      });
    await perform({
      type: "enter",
      actor: role,
      revision: current.narrative.revision,
      worldId: current.narrative.selectedWorldId!,
      arc,
      opId: crypto.randomUUID(),
    });
  }
  const label = (k: Live2dKind) => names[k] ?? live2dModels[k].name;
  return (
    <dialog
      ref={dialog}
      className="narrative-dialog"
      aria-label="故事与记忆"
      onCancel={onClose}
    >
      <header className="narrative-header">
        <div>
          <h2>故事与记忆</h2>
          <p>
            {name} · {world?.name ?? "从一次相遇开始"}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="关闭故事与记忆"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <nav className="narrative-tabs" aria-label="故事与记忆分类">
        {(
          [
            ["story", "故事", BookOpen],
            ["known", "已知故事", Check],
            ["memory", "记忆", Brain],
            ["saves", "存档", GitBranch],
          ] as const
        ).map(([id, text, Icon]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {text}
          </button>
        ))}
      </nav>
      <div className="narrative-body">
        {(error || chat?.memoryNotice) && (
          <p className="notice" role="status">
            {error || chat?.memoryNotice}
          </p>
        )}
        {!chat ? (
          <p role="status">正在展开故事与记忆…</p>
        ) : (
          <>
            {tab === "story" && (
              <>
                <StoryScene
                  chat={chat}
                  kind={kind}
                  busy={busy || !!chat.active}
                  onAction={(input) => run(() => perform(input))}
                />
                {world?.activeArc === "joint" && !world.paused && (
                  <div className="narrative-participants">
                    <span>交流对象</span>
                    {characterOrder.map((k) => (
                      <button
                        key={k}
                        className="secondary"
                        disabled={busy || !!chat.active || k === kind}
                        onClick={() =>
                          void run(async () => {
                            await window.buddy.setPreferences({ character: k });
                            setKind(k);
                            const next = await window.buddy.getChat();
                            await perform({
                              type: "enter",
                              actor: k,
                              arc: "joint",
                              worldId: world.id,
                              revision: next.narrative.revision,
                              opId: crypto.randomUUID(),
                            });
                          })
                        }
                      >
                        {label(k)}
                        {k === "miara" && world.flags.includes("miara.departed")
                          ? " · 通信"
                          : ""}
                      </button>
                    ))}
                  </div>
                )}
                <div className="narrative-arcs">
                  {characterOrder.map((k) => {
                    const arc = storyCatalog[k],
                      node = world?.tracks[k];
                    return (
                      <article className="narrative-arc" key={k}>
                        <img
                          src={portraits[`../assets/characters/${k}.png`]}
                          alt=""
                        />
                        <div>
                          <small>{label(k)}</small>
                          <h3>{arc.title}</h3>
                          <p>{arc.invitation}</p>
                          {node && (
                            <span className="narrative-tag">
                              {arc.nodes[node]?.ending
                                ? "已留下一个结局"
                                : arc.nodes[node]?.title}
                            </span>
                          )}
                          <button
                            className="secondary"
                            disabled={busy || !!chat.active || world?.archived}
                            aria-label={`${node ? "继续" : "开始"} ${arc.title}`}
                            onClick={() => void run(() => enter(k))}
                          >
                            {node ? "继续这段故事" : "一起经历"}
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <article className="narrative-joint">
                  <small>交汇的故事</small>
                  <h3>第八分钟</h3>
                  <p>带着不同人的线索来到零号站，决定总账应该交给谁。</p>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!chat.active ||
                      !world ||
                      new Set(world.evidence.map((e) => e.owner)).size < 2 ||
                      world.archived
                    }
                    onClick={() => void run(() => enter("joint"))}
                  >
                    参加联合听证
                  </button>
                  <small>
                    取得至少两位角色的线索后可参与；不必先完成全部个人线。
                  </small>
                </article>
              </>
            )}
            {tab === "known" && (
              <>
                <p className="muted">
                  当前存档中你已获得的材料。查看作者档案不会获得故事证据。
                </p>
                {!world?.evidence.length ? (
                  <div className="narrative-empty">
                    还没有留下故事线索，先和一位伙伴经历一段故事吧。
                  </div>
                ) : (
                  world.evidence.map((e) => (
                    <article className="narrative-record" key={e.id}>
                      <span className={`narrative-tag ${e.type}`}>
                        {e.type === "confirmed"
                          ? "已确认"
                          : e.type === "claim"
                            ? "TA 的说法"
                            : "线索"}
                      </span>
                      <h3>{e.title}</h3>
                      <p>{e.text}</p>
                      <small>
                        来源：{label(e.owner)} ·{" "}
                        {e.public
                          ? "已公开"
                          : `已知情：${e.knownBy.map(label).join("、")}`}{" "}
                        ·{" "}
                        {e.sharePolicy === "limited"
                          ? "有限查验"
                          : "可公开引用"}
                      </small>
                      <div className="narrative-controls">
                        <select
                          aria-label={`展示 ${e.title} 给谁`}
                          value={audiences[e.id] ?? kind}
                          onChange={(event) =>
                            setAudiences((old) => ({
                              ...old,
                              [e.id]: event.target.value as Live2dKind,
                            }))
                          }
                        >
                          {characterOrder.map((k) => (
                            <option key={k} value={k}>
                              {label(k)}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary"
                          disabled={busy || !!chat.active}
                          onClick={() =>
                            void run(() =>
                              act("share", {
                                evidenceId: e.id,
                                audience: [audiences[e.id] ?? kind],
                              }),
                            )
                          }
                        >
                          展示给 TA
                        </button>
                        {e.sharePolicy === "public" && !e.public && (
                          <button
                            className="secondary"
                            disabled={busy || !!chat.active}
                            onClick={() =>
                              void run(() =>
                                act("share", {
                                  evidenceId: e.id,
                                  audience: [...characterOrder],
                                }),
                              )
                            }
                          >
                            向全体展示
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </>
            )}
            {tab === "memory" && (
              <>
                <div className="memory-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      checked={n!.autoMemory}
                      disabled={busy || !!chat.active}
                      onChange={(e) =>
                        void run(() =>
                          act("autoMemory", { enabled: e.target.checked }),
                        )
                      }
                    />{" "}
                    自动记住有用的事
                  </label>
                  <small>关闭后停止新增，已有记忆仍可使用和删除。</small>
                  <div className="narrative-controls">
                    <button
                      className="secondary"
                      disabled={busy || !!chat.active}
                      onClick={() => void run(() => act("organize"))}
                    >
                      整理最近 8 条记录
                    </button>
                    <button
                      className="text-button"
                      disabled={
                        busy || !!chat.active || !n!.memories[kind].length
                      }
                      onClick={() =>
                        setConfirm({
                          text: `清空 ${name} 的全部长期记忆？聊天仍可查看，故事存档保留。`,
                          action: () => act("clearMemory"),
                        })
                      }
                    >
                      清空本角色记忆
                    </button>
                  </div>
                </div>
                <p className="muted">
                  需要更正时，直接在聊天里告诉 TA。整理会使用当前 AI
                  服务处理最近符合条件的原话。
                </p>
                {!n!.memories[kind].length ? (
                  <div className="narrative-empty">
                    还没有长期记忆。可以试着说：“记住我不喝咖啡”。
                  </div>
                ) : (
                  n!.memories[kind]
                    .filter((m) => m.status !== "superseded")
                    .map((m) => (
                      <article className="narrative-record" key={m.id}>
                        <div className="memory-title">
                          <span className="narrative-tag">
                            {m.status === "uncertain"
                              ? "待澄清，暂不使用"
                              : m.explicit
                                ? "你让 TA 记住的"
                                : "来自对话"}
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`忘记 ${m.text}`}
                            disabled={busy || !!chat.active}
                            onClick={() =>
                              setConfirm({
                                text: `忘记“${m.text}”？关联原话将不再提供给后续 AI 回复。`,
                                action: () => act("forget", { memoryId: m.id }),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p>{m.text}</p>
                        <details>
                          <summary>
                            查看来源 ·{" "}
                            {new Date(m.at).toLocaleDateString("zh-CN")}
                          </summary>
                          <blockquote>{m.sourceText}</blockquote>
                        </details>
                      </article>
                    ))
                )}
              </>
            )}
            {tab === "saves" && (
              <>
                <form
                  className="narrative-controls"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await act("create", newName ? { name: newName } : {});
                      setNewName("");
                    });
                  }}
                >
                  <input
                    aria-label="新故事存档名称"
                    placeholder="给新的故事取个名字（可选）"
                    value={newName}
                    maxLength={60}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={busy || !!chat.active || n!.worlds.length >= 20}
                  >
                    新的相遇
                  </button>
                </form>
                <small>
                  已保留 {n!.worlds.length}/20
                  个存档。另一种选择会建立副本，原路线保留。
                </small>
                {n!.worlds.map((w) => (
                  <article className="narrative-record" key={w.id}>
                    <h3>
                      {w.name}{" "}
                      {w.id === world?.id && (
                        <span className="narrative-tag">当前故事</span>
                      )}
                    </h3>
                    <small>
                      {w.archived ? "已归档" : "进行中"} ·{" "}
                      {w.events.filter((e) => !e.choice.startsWith("@")).length}{" "}
                      次选择
                    </small>
                    <div className="narrative-controls">
                      <button
                        className="secondary"
                        disabled={
                          busy ||
                          !!chat.active ||
                          w.archived ||
                          w.id === world?.id
                        }
                        onClick={() =>
                          void run(() => act("select", { worldId: w.id }))
                        }
                      >
                        切换到这个故事
                      </button>
                      <button
                        className="text-button"
                        disabled={busy || !!chat.active}
                        onClick={() =>
                          void run(() =>
                            act("archive", {
                              worldId: w.id,
                              enabled: !w.archived,
                            }),
                          )
                        }
                      >
                        <Archive size={14} />
                        {w.archived ? "恢复" : "归档"}
                      </button>
                      <button
                        className="text-button"
                        disabled={busy || !!chat.active}
                        onClick={() =>
                          setConfirm({
                            text: `删除「${w.name}」及这条路线的剧情对话？真实用户记忆保留，此操作不可撤销。`,
                            action: () => act("deleteWorld", { worldId: w.id }),
                          })
                        }
                      >
                        删除
                      </button>
                    </div>
                    {w.id === world?.id && (
                      <details open>
                        <summary>已走过的分歧点</summary>
                        {w.events
                          .filter((e) => !e.choice.startsWith("@"))
                          .map((e) => (
                            <div className="story-checkpoint" key={e.id}>
                              <p>{e.text}</p>
                              <button
                                className="secondary"
                                disabled={
                                  busy ||
                                  !!chat.active ||
                                  n!.worlds.length >= 20
                                }
                                onClick={() =>
                                  void run(() =>
                                    act("fork", {
                                      worldId: w.id,
                                      eventId: e.id,
                                    }),
                                  )
                                }
                              >
                                从这里尝试另一种选择
                              </button>
                            </div>
                          ))}
                      </details>
                    )}
                  </article>
                ))}
              </>
            )}
          </>
        )}
        {confirm && (
          <section
            className="narrative-confirm"
            role="alertdialog"
            aria-label="确认操作"
          >
            <p>{confirm.text}</p>
            <div className="narrative-controls">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                取消
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await confirm.action();
                    setConfirm(null);
                  })
                }
              >
                确认
              </button>
            </div>
          </section>
        )}
      </div>
    </dialog>
  );
}
