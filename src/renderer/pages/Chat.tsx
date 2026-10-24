/// <reference types="vite/client" />
import { useEffect, useRef, useState } from "react";
import {
  Settings,
  MessageCircle,
  Send,
  Square,
  Trash2,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import type { ChatState } from "../../shared/chat";
import {
  characterName,
  characterOrder,
  normalizeCharacter,
} from "../../shared/characters";
import "../styles/chat.css";
import AISettingsDialog from "../components/AISettingsDialog";
const portraits = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
export default function Chat({ snapshot }: { snapshot: Snapshot }) {
  const p = snapshot.state.preferences,
    kind = normalizeCharacter(p.character),
    name = characterName(kind, p);
  const [chat, setChat] = useState<ChatState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [away, setAway] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void window.buddy
      .getAISettings()
      .then((s) => {
        if (live) setAiEnabled(s.enabled);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const list = useRef<HTMLDivElement>(null),
    following = useRef(true),
    composing = useRef(false);
  useEffect(() => {
    let live = true,
      revision = 0;
    const off = window.buddy.onChat((s) => {
      revision++;
      if (live) setChat(s);
    });
    const before = revision;
    void window.buddy
      .getChat()
      .then((s) => {
        if (live && revision === before) setChat(s);
      })
      .catch(() => {
        if (live) setError("聊天记录读取失败，请重新进入页面。");
      });
    return () => {
      live = false;
      off();
    };
  }, []);
  const messages = chat?.sessions[kind] ?? [],
    draft = drafts[kind] ?? "",
    active = !!chat?.active;
  useEffect(() => {
    following.current = true;
    setAway(false);
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [kind]);
  useEffect(() => {
    if (following.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [chat, kind]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (busy || active || !draft.trim()) return;
    const text = draft;
    await action(async () => {
      await window.buddy.sendChat(text);
      setDrafts((old) => ({ ...old, [kind]: "" }));
      following.current = true;
      setAway(false);
    });
  }
  return (
    <div className="chat-layout">
      <section className="chat-card card" aria-label="伙伴聊天">
        {settingsOpen && (
          <AISettingsDialog onClose={() => setSettingsOpen(false)} />
        )}
        <header className="chat-heading">
          <img src={portraits[`../assets/characters/${kind}.png`]} alt="" />
          <div>
            <h2>{name}</h2>
            <p>{active ? "正在回复…" : "留一点时间，说说今天。"}</p>
          </div>
          {aiEnabled && (
            <button
              className="icon-button"
              aria-label="AI 服务设置"
              title="AI 服务设置（开发版）"
              disabled={active}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>
          )}
          <label className="chat-switch">
            聊天伙伴
            <select
              aria-label="聊天伙伴"
              value={kind}
              disabled={busy}
              onChange={(e) =>
                void action(() =>
                  window.buddy.setPreferences({
                    character: e.target.value as typeof kind,
                  }),
                )
              }
            >
              {characterOrder.map((k) => (
                <option key={k} value={k}>
                  {characterName(k, p)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="清空聊天记录"
            title="清空当前角色记录"
            disabled={busy || active || !messages.length}
            onClick={() =>
              void action(async () => {
                setChat(await window.buddy.clearChat());
              })
            }
          >
            <Trash2 size={18} />
          </button>
        </header>
        <p className="chat-privacy">
          聊天内容会发送至 AI
          服务生成回复；工资和工作计划不会自动发送。每位伙伴在本机保留最近 500
          条记录。
        </p>
        {(error || chat?.notice) && (
          <div className="notice" role="alert">
            {error || chat?.notice}
          </div>
        )}
        <div
          className="chat-messages"
          ref={list}
          onScroll={() => {
            const el = list.current;
            if (!el) return;
            following.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 70;
            setAway(!following.current);
          }}
          aria-label="聊天消息"
        >
          {!chat ? (
            <div className="chat-empty" role="status">
              正在读取聊天记录…
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <MessageCircle size={36} />
              <h3>和{name}打个招呼吧</h3>
              <p>聊聊今天的心情，或分享一件小事。</p>
              <div className="chat-suggestions">
                {["今天有点累，陪我聊聊吧", "你会怎么介绍自己？"].map((t) => (
                  <button
                    className="secondary"
                    key={t}
                    onClick={() => setDrafts((old) => ({ ...old, [kind]: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <article
                className={`chat-message ${m.role}`}
                key={m.id}
                data-status={m.status}
              >
                <small>{m.role === "user" ? "我" : name}</small>
                <div className="chat-bubble">
                  {m.content ||
                    (m.status === "streaming" ? (
                      <span className="chat-thinking">正在想怎么回复…</span>
                    ) : (
                      "未生成回复"
                    ))}
                </div>
                {m.status === "error" && (
                  <p className="chat-message-error">{m.error}</p>
                )}
                {m.status === "stopped" && <p className="muted">已停止生成</p>}
                {i === messages.length - 1 &&
                  ["error", "stopped"].includes(m.status) && (
                    <button
                      className="text-button"
                      disabled={busy || active}
                      onClick={() =>
                        void action(() => window.buddy.retryChat())
                      }
                    >
                      <RotateCcw size={14} />
                      重新回复
                    </button>
                  )}
              </article>
            ))
          )}
        </div>
        {away && (
          <button
            className="chat-bottom secondary"
            onClick={() => {
              following.current = true;
              setAway(false);
              if (list.current)
                list.current.scrollTop = list.current.scrollHeight;
            }}
          >
            <ArrowDown size={14} />
            回到底部
          </button>
        )}
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="聊天内容"
            placeholder={`想对${name}说什么？`}
            value={draft}
            maxLength={2000}
            onChange={(e) =>
              setDrafts((old) => ({ ...old, [kind]: e.target.value }))
            }
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                !composing.current &&
                e.keyCode !== 229
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="chat-compose-footer">
            <small>{draft.length}/2000 · Shift + Enter 换行</small>
            {active ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void action(() => window.buddy.stopChat())}
              >
                <Square size={15} />
                停止回复
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || !chat || !draft.trim()}
              >
                <Send size={15} />
                发送
              </button>
            )}
          </div>
        </form>
        <span className="chat-disclaimer">
          AI 回复可能不准确，请按实际情况判断。
        </span>
      </section>
      <aside className="chat-companion-rail" aria-label="聊天伙伴展示">
        <img src={portraits[`../assets/characters/${kind}.png`]} alt="" />
        <div className="chat-rail-copy">
          <strong className="chat-rail-name">{name}</strong>

          <button
            className="secondary"
            onClick={() =>
              void action(async () => {
                await window.buddy.showCompanion();
                await window.buddy.openDesktopChat();
              })
            }
          >
            打开桌面聊天
          </button>
        </div>
      </aside>
    </div>
  );
}
