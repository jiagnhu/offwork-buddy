import { useEffect, useRef, useState } from "react";
import {
  Pin,
  PinOff,
  Minus,
  Plus,
  Shuffle,
  Settings,
  GripHorizontal,
  X,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import Character from "../characters/Character";
import { countdown, money, statusLabels } from "../components/format";
export default function Companion({ snapshot }: { snapshot: Snapshot }) {
  const p = snapshot.state.preferences;
  const [speech, setSpeech] = useState(""),
    [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef(snapshot.progress.status);
  const [viewport, setViewport] = useState({
    width: innerWidth,
    height: innerHeight,
  });
  useEffect(() => {
    const update = () =>
      setViewport({ width: innerWidth, height: innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const canvasHeight = p.collapsed ? 290 : 500;
  const effectiveScale = Math.min(
    p.scale,
    viewport.width / 360,
    viewport.height / canvasHeight,
  );
  function say(text: string) {
    if (timer.current) clearTimeout(timer.current);
    setSpeech(text);
    timer.current = setTimeout(() => setSpeech(""), 4500);
  }
  useEffect(() => {
    if (previous.current !== snapshot.progress.status) {
      say(
        snapshot.progress.status === "finished"
          ? "收工！现在是你的时间啦 ✨"
          : snapshot.progress.status === "working"
            ? "开工啦，我会一直陪着你。"
            : snapshot.progress.status === "break"
              ? "先吃饭，再慢慢变富。"
              : "今天也要照顾好自己。",
      );
      previous.current = snapshot.progress.status;
    }
  }, [snapshot.progress.status]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function prefs(
    value: Parameters<typeof window.buddy.setPreferences>[0],
  ) {
    try {
      await window.buddy.setPreferences(value);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const messages = [
    "不急，一点一点来也很好。",
    "再忙也要喝口水呀。",
    "今天的努力，我都看见啦。",
    "下班之后，去做喜欢的事吧。",
  ];
  return (
    <div
      className="companion-root"
      style={{
        width: 360,
        height: canvasHeight,
        transform: `scale(${effectiveScale})`,
      }}
    >
      <div className="companion-toolbar">
        <span className="drag-handle" title="拖动到喜欢的位置">
          <GripHorizontal size={17} />
        </span>
        <button
          aria-label="切换伙伴"
          title="切换伙伴"
          onClick={() =>
            prefs({ character: p.character === "pet" ? "assistant" : "pet" })
          }
        >
          <Shuffle size={14} />
        </button>
        <button
          aria-label="切换置顶"
          title={p.alwaysOnTop ? "取消置顶" : "置顶"}
          onClick={() => prefs({ alwaysOnTop: !p.alwaysOnTop })}
        >
          {p.alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button
          aria-label={p.collapsed ? "展开信息卡" : "收起信息卡"}
          onClick={() => prefs({ collapsed: !p.collapsed })}
        >
          {p.collapsed ? <Plus size={14} /> : <Minus size={14} />}
        </button>
        <button aria-label="打开设置" onClick={() => window.buddy.openPanel()}>
          <Settings size={14} />
        </button>
        <button
          aria-label="隐藏伙伴"
          onClick={() => window.buddy.hideCompanion()}
        >
          <X size={14} />
        </button>
      </div>
      <div className="companion-stage">
        {speech && <div className="speech-bubble">{speech}</div>}
        <Character
          kind={p.character}
          status={snapshot.progress.status}
          reducedMotion={p.reducedMotion}
          onInteract={() =>
            say(messages[Math.floor(Math.random() * messages.length)])
          }
        />
      </div>
      {!p.collapsed && (
        <section className="floating-card">
          <header className="drag-handle">
            <span className="live-dot" />
            {statusLabels[snapshot.progress.status]}
            <small>OFFWORK BUDDY</small>
          </header>
          {!snapshot.state.configured ? (
            <>
              <h3>让每一秒，都有回报。</h3>
              <button
                className="primary full"
                onClick={() => window.buddy.openPanel()}
              >
                设置我的工作日
              </button>
            </>
          ) : (
            <>
              <p className="float-caption">
                {snapshot.progress.status === "finished"
                  ? "下班快乐，今天辛苦啦"
                  : snapshot.progress.status === "rest"
                    ? "今日休息，好好享受生活"
                    : "距离下班还有"}
              </p>
              <strong className="float-clock">
                {snapshot.progress.status === "rest"
                  ? "DAY OFF"
                  : countdown(snapshot.progress.countdownSeconds).join(" : ")}
              </strong>
              <div className="float-line">
                <span
                  style={{ width: `${snapshot.progress.fraction * 100}%` }}
                />
              </div>
              <div className="float-earnings">
                <div>
                  <small>今日预计</small>
                  <b>¥ {money(snapshot.progress.earnedCents)}</b>
                </div>
                <div>
                  <small>累计预计</small>
                  <b>¥ {money(snapshot.totalCents)}</b>
                </div>
              </div>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </div>
  );
}
