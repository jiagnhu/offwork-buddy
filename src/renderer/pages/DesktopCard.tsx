import { useState } from "react";
import type { Snapshot } from "../../shared/model";
import { GripHorizontal, Minus, Home } from "lucide-react";
import {
  countdown,
  countdownLabels,
  money,
  nativeMoney,
  statusLabels,
} from "../components/format";
import { useCompanionEvent, useDesktopScale } from "../hooks/useCompanionEvent";
import { primaryJob, listJobs } from "../../core/jobs";
import { jobDayIncome } from "../../core/work-income";
export default function DesktopCard({ snapshot }: { snapshot: Snapshot }) {
  const { state, progress, today } = snapshot,
    { event, dismiss } = useCompanionEvent();
  const [expanded, setExpanded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const job = primaryJob(state);
  const usdIncome =
    job.currency === "USD"
      ? jobDayIncome(state, job.id, today, new Date())
      : null;
  const scale = useDesktopScale(state.preferences.scale, 440),
    plans = state.plans[today] ?? [],
    done = plans.filter((p) => p.completed).length;
  const items = expanded
    ? plans
    : plans.filter((p) => !p.completed).slice(0, 1);
  const run = (p: Promise<unknown>) => void p.catch((e) => setError(e.message));
  async function toggle(id: string, completed: boolean) {
    setBusy(true);
    setError("");
    try {
      await window.buddy.updatePlan(
        today,
        { type: "complete", id, completed },
        job.id,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="desktop-card-root"
      style={{ width: 360, height: 440, transform: `scale(${scale})` }}
    >
      <section className="floating-card">
        <header>
          <span className="drag-handle card-drag">
            <GripHorizontal size={14} />
            {listJobs(state).length > 1 && job.name + " · "}
            {statusLabels[progress.status]}
          </span>
          <button
            aria-label="叫回伙伴"
            onClick={() => run(window.buddy.recallCompanion())}
          >
            <Home size={14} />
          </button>
          <button
            aria-label="隐藏信息卡"
            onClick={() => run(window.buddy.setCardHidden(true))}
          >
            <Minus size={14} />
          </button>
        </header>
        {!state.configured ? (
          <button
            className="primary full"
            onClick={() => run(window.buddy.openPanel())}
          >
            设置我的工作日
          </button>
        ) : (
          <>
            <p className="float-caption">
              {progress.status === "finished"
                ? "下班快乐，今天辛苦啦"
                : progress.status === "rest"
                  ? "今日休息，好好享受生活"
                  : countdownLabels[progress.countdownTarget]}
            </p>
            <strong className="float-clock">
              {progress.status === "rest"
                ? "今日休息"
                : countdown(progress.countdownSeconds).join(" : ")}
            </strong>
            <div className="float-line">
              <span style={{ width: `${progress.fraction * 100}%` }} />
            </div>
            <div className="float-earnings">
              <div>
                <small>今日预计</small>
                <button
                  className="money-link"
                  aria-label="查看今日工资明细"
                  onClick={() =>
                    run(
                      window.buddy.openPanel({
                        page: "earnings",
                        date: today,
                        jobId: job.id,
                      }),
                    )
                  }
                >
                  <b>{nativeMoney(progress.earnedCents, job.currency)}</b>
                  {usdIncome && (
                    <small>
                      {usdIncome.cnyCents === null
                        ? "待折算"
                        : ` ≈ ¥${money(usdIncome.cnyCents)}`}
                    </small>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
        {event?.kind === "reminder" && (
          <button
            className="card-reminder"
            aria-label="关闭提醒"
            onClick={dismiss}
          >
            {event.text} ×
          </button>
        )}
        <div className="desktop-plans">
          <div className="plan-heading">
            <h3>今日计划</h3>
            <button
              className="text-button"
              aria-label={expanded ? "收起今日计划" : "展开今日计划"}
              onClick={() => setExpanded(!expanded)}
            >
              {done}/{plans.length} · {expanded ? "收起" : "展开"}
            </button>
          </div>
          {!plans.length ? (
            <button
              className="text-button"
              onClick={() =>
                run(
                  window.buddy.openPanel({
                    page: "calendar",
                    date: today,
                    jobId: job.id,
                  }),
                )
              }
            >
              添加今日计划
            </button>
          ) : done === plans.length && !expanded ? (
            <p className="success">今天的计划已完成</p>
          ) : null}
          <ul className="plan-list">
            {items.map((p) => (
              <li key={p.id} className={p.completed ? "plan-completed" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={p.completed}
                    disabled={busy}
                    onChange={(e) => void toggle(p.id, e.target.checked)}
                  />
                  <span className="plan-text">{p.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
