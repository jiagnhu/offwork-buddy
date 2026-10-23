import { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowUpRight,
  Send,
  Square,
  RotateCcw,
  MessageCircle,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import type { ChatState } from "../../shared/chat";
import { characterName, normalizeCharacter } from "../../shared/characters";
import { useWindowVisible } from "../hooks/useWindowVisible";
import "../styles/desktop-chat.css";

export default function DesktopChat({ snapshot }: { snapshot: Snapshot }) {
  const kind = normalizeCharacter(snapshot.state.preferences.character);
  const name = characterName(kind, snapshot.state.preferences);
  const visible = useWindowVisible();
  const [chat, setChat] = useState<ChatState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null),
    reply = useRef<HTMLDivElement>(null);
  const composing = useRef(false),
    following = useRef(true),
    sending = useRef(false);
  const draft = drafts[kind] ?? "";
  const messages = chat?.sessions[kind] ?? [];
  const message = [...messages].reverse().find((m) => m.role === "assistant");
  const active = !!chat?.active;

  useEffect(() => {
    if (!visible) return;
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
        if (live) setError("聊天记录读取失败，请收起后重试。");
      });
    input.current?.focus();
    return () => {
      live = false;
      off();
    };
  }, [visible]);
  useEffect(() => {
    following.current = true;
    setError("");
    composing.current = false;
  }, [kind, message?.id]);
  useEffect(() => {
    if (visible && following.current && reply.current)
      reply.current.scrollTop = reply.current.scrollHeight;
  }, [visible, message?.content, message?.id]);
  async function action(fn: () => Promise<unknown>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function send() {
    if (!chat || active || !draft.trim()) return;
    const text = draft,
      sentKind = kind;
    await action(async () => {
      await window.buddy.sendChat(text);
      setDrafts((old) =>
        old[sentKind] === text ? { ...old, [sentKind]: "" } : old,
      );
      following.current = true;
    });
  }
  const close = () => void action(() => window.buddy.closeDesktopChat());
  return (
    <section
      className="desktop-chat"
      aria-label="桌面伙伴聊天"
      onKeyDown={(e) => {
        if (
          e.key === "Escape" &&
          !composing.current &&
          !e.nativeEvent.isComposing
        ) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header className="desktop-chat-heading">
        <span className="desktop-chat-avatar">
          <MessageCircle size={18} />
        </span>
        <div>
          <strong>{name}</strong>
          <small>{active ? "正在回复你…" : "我在这里，听你说"}</small>
        </div>
        <button
          className="icon-button"
          title="查看完整聊天"
          aria-label="查看完整聊天"
          onClick={() =>
            void action(async () => {
              await window.buddy.closeDesktopChat();
              await window.buddy.openPanel({ page: "chat" });
            })
          }
        >
          <ArrowUpRight size={17} />
        </button>
        <button
          className="icon-button"
          title="收起聊天"
          aria-label="收起聊天"
          onClick={close}
        >
          <X size={17} />
        </button>
      </header>
      <div
        className="desktop-chat-reply"
        ref={reply}
        data-status={message?.status}
        tabIndex={0}
        aria-label="伙伴回复"
        onScroll={() => {
          const el = reply.current;
          if (el)
            following.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 35;
        }}
      >
        {message?.content ||
          (message?.status === "streaming"
            ? "让我想想怎么回复你…"
            : `想和${name}聊些什么？`)}
        {message?.status === "stopped" && (
          <small className="desktop-chat-status">已停止回复</small>
        )}
      </div>
      {(error || message?.error || chat?.notice) && (
        <p className="desktop-chat-error" role="alert">
          {error || message?.error || chat?.notice}
        </p>
      )}
      {!active && message && ["error", "stopped"].includes(message.status) && (
        <button
          className="text-button desktop-chat-retry"
          disabled={busy}
          onClick={() => void action(() => window.buddy.retryChat())}
        >
          <RotateCcw size={13} />
          重新回复
        </button>
      )}
      <form
        className="desktop-chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={input}
          aria-label="桌面聊天内容"
          placeholder={`对${name}说点什么…`}
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
        <footer>
          <small>
            {draft.length
              ? `${draft.length}/2000`
              : "Enter 发送 · Shift+Enter 换行"}
          </small>
          {active ? (
            <button
              type="button"
              className="desktop-chat-send"
              aria-label="停止回复"
              disabled={busy}
              onClick={() => void action(() => window.buddy.stopChat())}
            >
              <Square size={15} />
            </button>
          ) : (
            <button
              className="desktop-chat-send"
              aria-label="发送"
              disabled={busy || !chat || !draft.trim()}
            >
              <Send size={16} />
            </button>
          )}
        </footer>
      </form>
      <small className="desktop-chat-note">
        消息发送至 AI 服务 · 回复仅供参考
      </small>
    </section>
  );
}
