import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  CalendarDays,
  X,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
import { monthDates, weekday } from "../../core/date";
import { resolveDay } from "../../core/calendar";
import { ruleForDate } from "../../core/ledger";
import { defaultRule } from "../../shared/defaults";
export default function Calendar({ snapshot }: { snapshot: Snapshot }) {
  const [month, setMonth] = useState(snapshot.today.slice(0, 7)),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const state = snapshot.state;
  const dates = monthDates(month);
  const rule = ruleForDate(state, selected ?? dates[0]) ??
    state.rules.at(-1) ?? {
      ...defaultRule(),
      id: "default",
      effectiveFrom: state.startDate,
    };
  const days = dates.map((date) => ({
    date,
    ...resolveDay(
      date,
      ruleForDate(state, date) ?? rule,
      state.calendar,
      state.overrides,
    ),
  }));
  const year = state.calendar[month.slice(0, 4)];
  const workdays = days.filter((d) => d.workday).length;
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
              className={`day ${d.workday ? "work" : "rest"} ${d.date === snapshot.today ? "today" : ""} ${d.source === "manual" ? "manual" : ""}`}
              onClick={() => setSelected(d.date)}
            >
              <span>{Number(d.date.slice(-2))}</span>
              <small>
                {d.source === "manual"
                  ? "已调整"
                  : d.source === "official"
                    ? d.workday
                      ? "调休上班"
                      : "节假休息"
                    : d.workday
                      ? "工作日"
                      : "休息日"}
              </small>
              {d.date === snapshot.today && <i>今天</i>}
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
          <span>点击日期，调整公司特殊排班</span>
        </div>
      </section>
      <section className="calendar-foot">
        <p className="muted">
          {year
            ? `已载入 ${month.slice(0, 4)} 年日历 · 更新于 ${year.updated}`
            : "节假日数据缺失，当前按常规排班"}
          <br />
          {!rule.official ? "当前已关闭官方日历覆盖。" : ""}
          历史日历调整不会自动修改已结算收入。
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section className="modal card">
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="关闭"
            >
              <X size={18} />
            </button>
            <span className="eyebrow">YOUR SCHEDULE</span>
            <h2>{selected} 怎么安排？</h2>
            <p className="muted">手动设置优先于节假日与每周排班。</p>
            <div className="button-row">
              <button className="primary" onClick={() => override(true)}>
                设为工作日
              </button>
              <button className="secondary" onClick={() => override(false)}>
                设为休息日
              </button>
            </div>
            <button className="text-button" onClick={() => override(null)}>
              恢复自动判断
            </button>
          </section>
        </div>
      )}
    </>
  );
}
