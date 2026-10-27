import { useEffect, useRef, useState } from "react";
import {
  Send,
  Square,
  RotateCcw,
  X,
  GripVertical,
  BookOpen,
  Check,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import type { ChatState } from "../../shared/chat";
import { normalizeCharacter } from "../../shared/characters";
import { useWindowVisible } from "../hooks/useWindowVisible";
import "../styles/desktop-chat.css";
export default function DesktopChat({ snapshot }: { snapshot: Snapshot }) {
  const kind = normalizeCharacter(snapshot.state.preferences.character),
    visible = useWindowVisible();
  const [chat, setChat] = useState<ChatState | null>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null),
    composing = useRef(false),
    sending = useRef(false);
  const draft = drafts[kind] ?? "",
    active = !!chat?.active,
    last = chat?.sessions[kind].at(-1);
  const retry =
    !active &&
    last?.role === "assistant" &&
    ["error", "stopped"].includes(last.status);
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
        if (live) setError("读取失败，请重新展开");
      });
    input.current?.focus();
    return () => {
      live = false;
      off();
    };
  }, [visible]);
  useEffect(() => {
    setError("");
    composing.current = false;
  }, [kind]);
  async function action(fn: () => Promise<unknown>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请重试");
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
    });
  }
  return (
    <form
      className="desktop-input"
      aria-label="桌面聊天输入"
      title="Enter 发送 · Shift+Enter 换行 · Esc 收起"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <span
        className="desktop-input-drag"
        title="拖动输入框"
        aria-label="拖动输入框"
      >
        <GripVertical size={14} />
      </span>
      <textarea
        ref={input}
        aria-label="桌面聊天内容"
        placeholder="说点什么…"
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
            e.nativeEvent.isComposing ||
            composing.current ||
            e.keyCode === 229
          )
            return;
          if (e.key === "Escape") {
            e.preventDefault();
            void window.buddy.closeDesktopChat();
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      {retry && !draft.trim() ? (
        <button
          type="button"
          className="desktop-chat-send"
          aria-label="重新回复"
          title="重新回复"
          disabled={busy}
          onClick={() => void action(() => window.buddy.retryChat())}
        >
          <RotateCcw size={17} />
        </button>
      ) : active ? (
        <button
          type="button"
          className="desktop-chat-send"
          aria-label="停止回复"
          title="停止回复"
          disabled={busy}
          onClick={() => void action(() => window.buddy.stopChat())}
        >
          <Square size={16} />
        </button>
      ) : (
        <button
          className="desktop-chat-send"
          aria-label="发送"
          title="发送"
          disabled={busy || !chat || !draft.trim()}
        >
          <Send size={17} />
        </button>
      )}
      <button
        type="button"
        className="desktop-chat-close"
        aria-label="收起聊天"
        title="收起聊天"
        onClick={() => void window.buddy.closeDesktopChat()}
      >
        <X size={15} />
      </button>
      {chat?.offer?.kind === kind && chat.offer.choiceId ? (
        <button
          type="button"
          className="desktop-chat-send"
          aria-label="确认剧情行动"
          title={chat.offer.label}
          disabled={busy || active}
          onClick={() =>
            void action(() =>
              window.buddy.narrativeAction({
                actor: kind,
                type: "choose",
                revision: chat.offer!.revision,
                opId: crypto.randomUUID(),
                worldId: chat.offer!.worldId,
                arc: chat.offer!.arc,
                choiceId: chat.offer!.choiceId,
              }),
            )
          }
        >
          <Check size={16} />
        </button>
      ) : (
        <button
          type="button"
          className="desktop-chat-send"
          aria-label="查看故事"
          title="打开伙伴聊天查看故事与记忆"
          onClick={() => void window.buddy.openPanel({ page: "chat" })}
        >
          <BookOpen size={16} />
        </button>
      )}
      {error && (
        <small className="desktop-input-error" role="alert" title={error}>
          {error}
        </small>
      )}
    </form>
  );
}
