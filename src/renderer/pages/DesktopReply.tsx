import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DesktopReply as Reply } from "../../shared/desktop-reply";
import { splitReplyPages } from "../components/reply-pages";
import "../styles/desktop-chat.css";
export default function DesktopReply() {
  const [reply, setReply] = useState<Reply | null>(null);
  const [height, setHeight] = useState(135),
    [pages, setPages] = useState(["…"]),
    [page, setPage] = useState(0);
  const wrap = useRef<HTMLDivElement>(null),
    measure = useRef<HTMLDivElement>(null);
  const lastId = useRef("");
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
    if (!wrap.current) return;
    let last = 0;
    const observer = new ResizeObserver(([entry]) => {
      const h = Math.ceil(
        entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height,
      );
      if (h !== last) {
        last = h;
        void window.buddy.shapeDesktopReply(h);
      }
    });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, [!!reply]);
  useLayoutEffect(() => {
    if (!reply || !measure.current) return;
    const m = reply.message,
      el = measure.current;
    const text =
      (m.content || (m.status === "streaming" ? "…" : "暂时没有回复")) +
      (m.error ? "\n" + m.error : "") +
      (m.status === "stopped" ? "\n已停止回复" : "");
    const getHeight = (s: string) => {
      el.textContent = s;
      return el.scrollHeight;
    };
    const limit = Math.max(60, reply.maxHeight);
    const full = getHeight(text);
    const next =
      full + 42 <= limit
        ? [text]
        : splitReplyPages(text, Math.max(22, limit - 78), getHeight);
    setPages(next);
    if (lastId.current !== m.id) {
      lastId.current = m.id;
      setPage(0);
    } else setPage((p) => Math.min(p, next.length - 1));
  }, [
    reply?.message.content,
    reply?.message.id,
    reply?.message.status,
    reply?.message.error,
    reply?.maxHeight,
  ]);
  useLayoutEffect(() => {
    if (!reply || !measure.current) return;
    measure.current.textContent = pages[page] ?? "";
    const target = Math.min(
      reply.maxHeight,
      Math.max(
        135,
        measure.current.scrollHeight + 42 + (pages.length > 1 ? 36 : 0),
      ),
    );
    let live = true;
    // Reserve native space before animating the inner bubble, rather than resizing
    // the window on every animation frame or showing temporary scrollbars.
    void window.buddy.resizeDesktopReply(target).then(() => {
      if (live) setHeight(target);
    });
    return () => {
      live = false;
    };
  }, [pages, page, reply?.maxHeight]);
  if (!reply) return null;
  const turn = (index: number) => {
    setPage(index);
    void window.buddy.keepDesktopReply();
  };
  return (
    <>
      <div className="comic-measure" aria-hidden="true" ref={measure} />
      <div
        ref={wrap}
        className="comic-wrap"
        data-side={reply.side}
        style={{ height }}
      >
        <div
          className="comic-bubble"
          aria-label="伙伴对白"
          data-status={reply.message.status}
        >
          <div className="comic-text">{pages[page]}</div>
          {pages.length > 1 && (
            <nav className="comic-pages" aria-label="回复分页">
              <button
                aria-label="上一页"
                disabled={page === 0}
                onClick={() => turn(page - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                {page + 1} / {pages.length}
              </span>
              <button
                aria-label="下一页"
                disabled={page === pages.length - 1}
                onClick={() => turn(page + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
