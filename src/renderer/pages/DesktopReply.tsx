import { useEffect, useRef, useState } from "react";
import type { DesktopReply as Reply } from "../../shared/desktop-reply";
import "../styles/desktop-chat.css";
export default function DesktopReply() {
  const [reply, setReply] = useState<Reply | null>(null);
  const body = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    following = useRef(true);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHeight = useRef(64),
    sentHeight = useRef(0);
  useEffect(
    () => () => {
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    },
    [],
  );
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
    pendingHeight.current = Math.min(
      270,
      Math.max(64, content.current.scrollHeight + 42),
    );
    if (pendingHeight.current !== sentHeight.current && !resizeTimer.current) {
      resizeTimer.current = setTimeout(() => {
        resizeTimer.current = null;
        if (sentHeight.current === pendingHeight.current) return;
        sentHeight.current = pendingHeight.current;
        void window.buddy.resizeDesktopReply(sentHeight.current);
      }, 120);
    }
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
