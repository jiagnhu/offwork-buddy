import Character from "../characters/Character";
import {
  ArrowUpRight,
  Clock3,
  Wallet,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Pin,
  ChevronRight,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import {
  countdown,
  countdownLabels,
  money,
  statusLabels,
  time,
} from "../components/format";
import { ruleForDate } from "../../core/ledger";
import { addDays, weekday } from "../../core/date";
import { resolveDay } from "../../core/calendar";
export default function Overview({
  snapshot,
  navigate,
}: {
  snapshot: Snapshot;
  navigate: (p: string) => void;
}) {
  const { state, progress } = snapshot;
  const rule = ruleForDate(state, snapshot.today) ?? state.rules.at(-1)!;
  const digits = countdown(progress.countdownSeconds);
  const monday = addDays(snapshot.today, -((weekday(snapshot.today) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <>
      <div className="overview-grid">
        <section className="countdown-hero">
          <div className="hero-top">
            <span className="pill">
              <i className="live-dot" />
              {statusLabels[progress.status]}
            </span>
            <Clock3 size={22} />
          </div>
          <p className="hero-caption">
            {progress.status === "finished"
              ? "工作已收尾，生活正开始"
              : progress.status === "rest"
                ? "今天，把时间留给自己"
                : countdownLabels[progress.countdownTarget]}
          </p>
          <div className="clock-display">
            {progress.status === "rest" ? (
              <strong className="rest-title">休息一下 ☁</strong>
            ) : (
              digits.map((d, i) => (
                <span key={i} className="clock-group">
                  <strong>{d}</strong>
                  <small>{["小时", "分钟", "秒钟"][i]}</small>
                  {i < 2 && <b>:</b>}
                </span>
              ))
            )}
          </div>
          <div className="hero-progress">
            <div style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <div className="hero-bottom">
            <span>{time(rule.start)} 上班</span>
            <span>今日进度 {Math.round(progress.fraction * 100)}%</span>
            <span>{time(rule.end)} 下班</span>
          </div>
          <div className="hero-flower">✳</div>
        </section>
        <section className="buddy-card card">
          <div className="section-title">
            <span className="tiny-pill">陪伴中</span>
          </div>
          <div className="overview-character" id="character-preview">
            <Character
              kind={state.preferences.character}
              status={progress.status}
              reducedMotion={state.preferences.reducedMotion}
              onInteract={() => window.buddy.showCompanion()}
            />
          </div>
          <div className="buddy-copy">
            <h2>
              {state.preferences.character === "pet" ? "年糕" : "小沐"}
              陪你，慢慢来。
            </h2>
            <p>认真生活，也要记得休息。</p>
          </div>
          <button
            className="secondary full"
            onClick={() => window.buddy.showCompanion()}
          >
            <Pin size={15} />
            把搭子放到桌面
            <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
      <div className="stats-grid">
        <section className="card stat-card">
          <span className="stat-icon mint">
            <Wallet size={20} />
          </span>
          <span className="muted">今日预计收入</span>
          <strong className="stat-value">
            {" "}
            <button className="money-link" aria-label="查看今日工资明细" onClick={()=>window.buddy.openPanel({page:'earnings',date:snapshot.today})}><small>¥</small> {money(progress.earnedCents)}</button>
          </strong>
          <p>
            <i className="live-dot" />
            {progress.status === "working"
              ? "每一秒，都在积累"
              : statusLabels[progress.status]}
          </p>
        </section>
        <section className="card stat-card">
          <span className="stat-icon lavender">
            <TrendingUp size={20} />
          </span>
          <span className="muted">累计预计收入</span>
          <strong className="stat-value">
            <button className="money-link" aria-label="查看累计收入明细" onClick={()=>window.buddy.openPanel({page:'earnings',date:snapshot.today})}><small>¥</small> {money(snapshot.totalCents)}</button>
          </strong>
          <p>
            包含今日进度 · 从 {state.startDate.slice(5).replace("-", "/")} 开始
          </p>
        </section>
        <section className="card stat-card">
          <span className="stat-icon peach">
            <CalendarDays size={20} />
          </span>
          <span className="muted">已记录的工作日</span>
          <strong className="stat-value">
            {Object.values(state.ledger).filter((e) => e.workday).length}
            <small> 天</small>
          </strong>
          <p>每一份努力，都会被记住</p>
        </section>
      </div>
      <section className="card week-card">
        <div className="section-title">
          <div>
            <h2>这一周，张弛有度。</h2>
          </div>
          <button className="text-button" onClick={() => navigate("calendar")}>
            查看日历
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="week-strip">
          {week.map((d, i) => {
            const info = resolveDay(
              d,
              ruleForDate(state, d) ?? rule,
              state.calendar,
              state.overrides,
            );
            return (
              <div
                key={d}
                className={`week-day ${d === snapshot.today ? "active" : ""} ${!info.workday ? "rest" : ""}`}
              >
                <span>周{["一", "二", "三", "四", "五", "六", "日"][i]}</span>
                <strong>{Number(d.slice(-2))}</strong>
                <small>
                  {d === snapshot.today
                    ? "今天"
                    : info.workday
                      ? "上班"
                      : "休息"}
                </small>
              </div>
            );
          })}
        </div>
      </section>
      <footer className="soft-footer">
        <Sparkles size={15} />
        今天的努力，是明天的小确幸。<span>收入为排班估算，不代表实际到账</span>
      </footer>
    </>
  );
}
