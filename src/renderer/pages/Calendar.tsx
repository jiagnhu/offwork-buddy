import LeaveEditor from "../components/LeaveEditor";
import type { PlanAction } from "../../core/plans";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  CalendarDays,
  X,
} from "lucide-react";
import type { Snapshot, DailyPlan } from "../../shared/model";
import { monthDates, weekday } from "../../core/date";
import { resolveDay } from "../../core/calendar";
import { ruleForDate } from "../../core/ledger";
import { defaultRule } from "../../shared/defaults";
import { calendarIncome } from "../../core/calendar-income";
import { money } from "../components/format";
export default function Calendar({
  snapshot,
  initialDate,
}: {
  snapshot: Snapshot;
  initialDate?: string;
}) {
  const [month, setMonth] = useState(snapshot.today.slice(0, 7)),
    [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const state = snapshot.state;
  useEffect(() => {
    if (initialDate) {
      setMonth(initialDate.slice(0, 7));
      setSelected(initialDate);
    }
  }, [initialDate]);
  const dates = monthDates(month);
  const rule = ruleForDate(state, selected ?? dates[0]) ??
    state.rules.at(-1) ?? {
      ...defaultRule(),
      id: "default",
      effectiveFrom: state.startDate,
    };
  const days = dates.map((date) => ({
    date,
    income: calendarIncome(state, date, new Date()),
    ...resolveDay(
      date,
      ruleForDate(state, date) ?? rule,
      state.calendar,
      state.overrides,
    ),
  }));
  const year = state.calendar[month.slice(0, 4)];
  const workdays = days.filter((d) => d.workday).length;
  const plans = selected ? (state.plans[selected] ?? []) : [];
  async function savePlans(next: PlanAction) {
    if (!selected || busy) return false;
    setBusy(true);
    setError("");
    try {
      await window.buddy.updatePlan(selected, next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function move(n: number) {
    const d = new Date(month + "-01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    const m = d.toISOString().slice(0, 7);
    if (m >= "2000-01" && m <= "2099-12") setMonth(m);
  }
  async function override(value: boolean | null) {
    if (!selected) return;
    try {
      await window.buddy.setDayOverride(selected, value);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <section className="calendar-summary">
        <div>
          <CalendarDays />
          <span>
            <strong>{workdays}</strong> 天工作
          </span>
        </div>
        <div>
          <span className="rest-dot" />
          <span>
            <strong>{days.length - workdays}</strong> 天休息
          </span>
        </div>
        <p>给努力留位置，也给生活留空白。</p>
      </section>
      <section className="card calendar-card">
        <div className="section-title">
          <div className="month-nav">
            <button aria-label="上个月" onClick={() => move(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h2>{month.replace("-", " 年 ")} 月</h2>
            <button aria-label="下个月" onClick={() => move(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            className="secondary"
            onClick={() => setMonth(snapshot.today.slice(0, 7))}
          >
            回到本月
          </button>
        </div>
        <div className="calendar-grid">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: (weekday(dates[0]) + 6) % 7 }, (_, i) => (
            <div key={"empty" + i} />
          ))}
          {days.map((d) => (
            <button
              key={d.date}
              aria-label={`${d.date} ${d.paidHoliday ?? (d.workday ? "工作日" : "休息日")}`}
              className={`day ${d.workday ? "work" : "rest"} ${d.date === snapshot.today ? "today" : ""} ${d.source === "manual" ? "manual" : ""}`}
              onClick={() => {
                setSelected(d.date);
                setDraft("");
                setError("");
              }}
            >
              <span>{Number(d.date.slice(-2))}</span>
              <small>
                {d.paidHoliday
                  ? `${d.paidHoliday} · 带薪`
                  : d.source === "manual"
                    ? "已调整"
                    : d.source === "official"
                      ? d.workday
                        ? "调休上班"
                        : "节假休息"
                      : d.workday
                        ? "工作日"
                        : "休息日"}
              </small>
              <span
                className="day-income"
                title={
                  d.income.kind === "settled"
                    ? "已结算收入"
                    : d.income.kind === "today"
                      ? "今日目前收入"
                      : "预计全天收入"
                }
              >
                {d.income.kind === "before-start"
                  ? state.configured
                    ? "未入职"
                    : "未设置"
                  : d.income.kind === "unconfigured"
                    ? "未设置"
                    : `${d.income.kind === "estimated" ? "预计 " : ""}¥${money(d.income.amountCents)}`}
              </span>
              {!!state.leaves?.[d.date]?.length && (
                <small className="leave-badge">已安排请假</small>
              )}
              {d.date === snapshot.today && <i>今天</i>}
              {!!state.plans[d.date]?.length && (
                <span className="day-plans">
                  计划 {state.plans[d.date].filter((p) => p.completed).length}/
                  {state.plans[d.date].length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="mint-dot" />
            工作日
          </span>
          <span>
            <i className="rest-dot" />
            休息日
          </span>
          <span>点击日期，安排计划、请假或调整排班</span>
        </div>
      </section>
      <section className="calendar-foot">
        <p className="muted">
          {year
            ? `已载入 ${month.slice(0, 4)} 年日历 · 更新于 ${year.updated}`
            : "节假日数据缺失，当前按常规排班"}
          <br />
          {!rule.official ? "当前已关闭官方日历覆盖。" : ""}
          历史排班调整不会自动修改已结算收入；请假增删会立即更新对应收入。
          今日显示当前收入，未来显示全天预计；带薪法定节假日按正常日薪计入，入职前不计薪。
        </p>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await window.buddy.importCalendar();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Upload size={16} />
          导入年度日历
        </button>
      </section>
      {error && !selected && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section
            className="modal card plan-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected} 工作计划`}
          >
            <button
              className="modal-close"
              disabled={busy}
              onClick={() => setSelected(null)}
              aria-label="关闭"
            >
              <X size={18} />
            </button>
            <h2>{selected} 怎么安排？</h2>
            <LeaveEditor
              key={selected}
              state={state}
              date={selected}
              busy={busy}
              setBusy={setBusy}
            />
            <hr className="plan-divider" />
            <div className="plan-heading">
              <h3>每日工作计划</h3>
              <span className="muted">
                {plans.filter((p) => p.completed).length}/{plans.length} 已完成
              </span>
            </div>
            <form
              className="plan-add"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                if (
                  await savePlans({
                    type: "add",
                    id: crypto.randomUUID(),
                    text: draft.trim(),
                  })
                )
                  setDraft("");
              }}
            >
              <input
                aria-label="新增工作计划"
                placeholder="今天想完成什么？"
                value={draft}
                maxLength={200}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                className="primary"
                disabled={busy || !draft.trim() || plans.length >= 100}
              >
                添加计划
              </button>
            </form>
            <ul className="plan-list">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className={plan.completed ? "plan-completed" : ""}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={plan.completed}
                      disabled={busy}
                      onChange={(e) =>
                        void savePlans({
                          type: "complete",
                          id: plan.id,
                          completed: e.target.checked,
                        })
                      }
                    />
                    <span className="plan-text">{plan.text}</span>
                  </label>
                  <button
                    className="plan-delete"
                    disabled={busy}
                    aria-label={`删除计划：${plan.text}`}
                    onClick={() =>
                      void savePlans({ type: "delete", id: plan.id })
                    }
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
            {!plans.length && (
              <p className="muted plan-empty">还没有计划，从一件小事开始吧。</p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <hr className="plan-divider" />
            <p className="muted">手动设置优先于节假日与每周排班。</p>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => override(true)}
              >
                设为工作日
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => override(false)}
              >
                设为休息日
              </button>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => override(null)}
            >
              恢复自动判断
            </button>
          </section>
        </div>
      )}
    </>
  );
}
