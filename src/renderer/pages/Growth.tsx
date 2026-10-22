import { useState } from "react";
import type { Snapshot, Preferences } from "../../shared/model";
import Character from "../characters/Character";
import { unlocks } from "../../core/growth";
export default function Growth({ snapshot }: { snapshot: Snapshot }) {
  const { growth, preferences: p } = snapshot.state,
    available = unlocks(growth.points),
    next = [10, 30, 60].find((n) => n > growth.points),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function wear(accessory: Preferences["accessory"]) {
    setBusy(true);
    try {
      await window.buddy.setPreferences({ accessory });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="growth-page">
      <section className="card growth-hero">
        <div className="growth-preview">
          <Character
            kind={p.character}
            status={snapshot.progress.status}
            reducedMotion={p.reducedMotion}
            accessory={p.accessory}
            pose={p.accessory === "pillow" ? "pillow" : "idle"}
            onInteract={() =>
              void window.buddy.interact().catch((e) => setError(e.message))
            }
          />
        </div>
        <div>
          <span className="muted">一起度过的每一天，都有小小收获</span>
          <h2>我们的默契，正在长大。</h2>
          <p className="growth-points">
            <strong>{growth.points}</strong> 成长点
          </p>
          <progress
            aria-label="成长进度"
            value={Math.min(growth.points, 60)}
            max={60}
          />
          <p>
            {next
              ? `再积攒 ${next - growth.points} 点，解锁下一份惊喜。`
              : "全部惊喜已解锁，陪伴仍在继续。"}
          </p>
          <small className="muted">
            每日首次互动 +1 · 完成今日计划 +2（每天最多 5 项）
            <br />
            撤销重勾、历史计划不重复奖励。
          </small>
        </div>
      </section>
      <section className="growth-rewards">
        {p.character==='haru'&&<p className="muted">星星和抱枕适用于年糕、小沐；已选配饰会保留，Haru 暂不佩戴这些配饰。</p>}
        {(
          [
            {
              id: "star",
              name: "星星",
              threshold: 10,
              icon: "✦",
              description: "把小小的努力，戴成闪亮的星。",
            },
            {
              id: "pillow",
              name: "抱枕",
              threshold: 30,
              icon: "☁",
              description: "休息的时候，也有柔软的陪伴。",
            },
          ] as const
        ).map((item) => (
          <article className="card" key={item.id}>
            <span className="reward-symbol">{item.icon}</span>
            <h3>{item.name}</h3>
            <p className="muted">{item.description}</p>
            <p>{available[item.id] ? "已解锁" : `${item.threshold} 点解锁`}</p>
            <button
              className="secondary"
              aria-label={`佩戴${item.name}`}
              disabled={!available[item.id] || busy || p.accessory === item.id}
              onClick={() => void wear(item.id)}
            >
              {p.accessory === item.id ? "正在佩戴" : `佩戴${item.name}`}
            </button>
          </article>
        ))}
        <article className="card">
          <span className="reward-symbol">✺</span>
          <h3>特别庆祝</h3>
          <p className="muted">每次完成今日计划，都为你喝彩。</p>
          <p>{available.celebration ? "特别庆祝已解锁" : "60 点解锁"}</p>
        </article>
      </section>
      <button
        className="secondary"
        disabled={busy || p.accessory === "none"}
        onClick={() => void wear("none")}
      >
        取下配饰
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
