import { useEffect, useRef, useState } from "react";
import type { DesktopReply as Reply } from "../../shared/desktop-reply";
import "../styles/desktop-chat.css";
export default function DesktopReply() {
  const [reply, setReply] = useState<Reply | null>(null);
  const body = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    following = useRef(true);
  useEffect(() => {
    let live = true,
      revision = 0;
    const off = window.buddy.onDesktopReply((r) => {
      revision++;
      if (live) setReply(r);
    });
    const before = revision;
    void window.buddy.getDesktopReply().then((r) => {
      if (live && revision === before) setReply(r);
    });
    return () => {
      live = false;
      off();
    };
  }, []);
  useEffect(() => {
    if (reply) document.documentElement.dataset.theme = reply.theme;
  }, [reply?.theme]);
  useEffect(() => {
    following.current = true;
  }, [reply?.message.id]);
  useEffect(() => {
    if (!content.current) return;
    void window.buddy.resizeDesktopReply(
      Math.min(270, Math.max(64, content.current.scrollHeight + 42)),
    );
    if (following.current && body.current)
      body.current.scrollTop = body.current.scrollHeight;
  }, [reply?.message.content, reply?.message.status, reply?.message.error]);
  if (!reply) return null;
  const m = reply.message;
  return (
    <div className="comic-wrap" data-side={reply.side}>
      <div
        className="comic-bubble"
        aria-label="伙伴对白"
        data-status={m.status}
        ref={body}
        onScroll={() => {
          const el = body.current;
          if (el)
            following.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 30;
        }}
      >
        <div ref={content}>
          {m.content || (m.status === "streaming" ? "…" : "暂时没有回复")}
          {m.error && <small className="comic-error">{m.error}</small>}
          {m.status === "stopped" && (
            <small className="comic-error">已停止回复</small>
          )}
        </div>
      </div>
    </div>
  );
}
