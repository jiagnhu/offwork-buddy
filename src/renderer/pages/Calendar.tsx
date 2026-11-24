import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import type { DayInfo, Snapshot, State } from "../../shared/model";
import { monthDates, weekday } from "../../core/date";
import { resolveDay } from "../../core/calendar";
import { ruleForDate } from "../../core/ledger";
import { listJobs, jobState, inJobPeriod, primaryJob } from "../../core/jobs";
import { jobDayIncome, jobPayday } from "../../core/work-income";
import { combinedMoney, money, nativeMoney } from "../components/format";
import LeaveEditor from "../components/LeaveEditor";
import { CalendarPlans } from "../components/CalendarPlans";
import "../styles/multi-jobs.css";

type Profile = ReturnType<typeof listJobs>[number];
type JobContext = { job: Profile; scope: State };
function calendarRow(state: State, ctx: JobContext, date: string, now: Date) {
  const { job, scope } = ctx;
  const rule = ruleForDate(scope, date);
  const active = inJobPeriod(job, date) && Boolean(rule);
  const info =
    active && rule
      ? resolveDay(date, rule, state.calendar, scope.overrides)
      : null;
  const payday = jobPayday(state, job.id, date);
  const income = jobDayIncome(state, job.id, date, now);
  return { ...ctx, active, info, income, payday };
}
type Row = ReturnType<typeof calendarRow>;
function statusText(info: DayInfo | null, activeLabel: string) {
  if (!info) return activeLabel;
  if (info.paidHoliday) return info.paidHoliday + " · 带薪";
  if (info.source === "manual") return info.workday ? "调整上班" : "调整休息";
  if (info.source === "official") return info.workday ? "调休上班" : "节假休息";
  return info.workday ? "工作日" : "休息日";
}
function rowStatus(row: Row, date: string) {
  return statusText(
    row.info,
    date < row.job.startDate
      ? "未入职"
      : row.job.endDate && date > row.job.endDate
        ? "已结束"
        : "未设置",
  );
}
function converted(row: Row) {
  return row.income.cnyCents === null
    ? "待折算"
    : "≈ ¥" + money(row.income.cnyCents);
}
function daySummary(rows: Row[], date: string, today: string) {
  if (!rows.length) return "无工作";
  if (rows.length === 1 && !rows[0].active) return rowStatus(rows[0], date);
  if (rows.length === 1 && rows[0].income.currency === "CNY") {
    return (
      (date > today ? "预计 " : "") +
      nativeMoney(rows[0].income.nativeCents, "CNY")
    );
  }
  let cny = 0,
    pending = 0;
  for (const { income } of rows) {
    if (income.cnyCents !== null) cny += income.cnyCents;
    else pending += income.nativeCents;
  }
  return (date > today ? "预计 " : "") + combinedMoney(cny, pending);
}
export default function Calendar({
  snapshot,
  initialDate,
  initialJobId,
}: {
  snapshot: Snapshot;
  initialDate?: string;
  initialJobId?: string;
}) {
  const { state, today } = snapshot;
  const jobs = listJobs(state),
    primary = primaryJob(state);
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [requestedOwner, setOwner] = useState(primary.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (initialDate) {
      setMonth(initialDate.slice(0, 7));
      setSelected(initialDate);
      setOwner(initialJobId ?? primary.id);
      if (initialJobId) setFilter(initialJobId);
      else setFilter("all");
      setError("");
    }
  }, [initialDate, initialJobId]);
  const selectedFilter = jobs.some((job) => job.id === filter) ? filter : "all";
  const all = selectedFilter === "all";
  const contexts = jobs
    .filter((job) => all || job.id === selectedFilter)
    .map((job) => ({ job, scope: jobState(state, job.id) }));
  const dates = monthDates(month),
    now = new Date();
  const days = dates.map((date) => {
    const rows = contexts.map((ctx) => calendarRow(state, ctx, date, now));
    const visible =
      all && jobs.length > 1
        ? rows.filter(
            (row) => row.active || row.payday || row.scope.plans[date]?.length,
          )
        : rows;
    const workday = visible.some((row) => row.info?.workday);
    const plans = visible.flatMap((row) => row.scope.plans[date] ?? []);
    if (all) plans.push(...(state.personalPlans?.[date] ?? []));
    return { date, rows: visible, workday, plans };
  });
  const workdays = days.filter((day) => day.workday).length;
  const selectedDay = days.find((day) => day.date === selected);
  const current =
    requestedOwner === "personal"
      ? undefined
      : (selectedDay?.rows.find((row) => row.job.id === requestedOwner) ??
        selectedDay?.rows[0]);
  const owner = current?.job.id ?? "personal";
  const personal = !current;
  const year = state.calendar[month.slice(0, 4)];
  function openDay(day: (typeof days)[number]) {
    setSelected(day.date);
    setOwner(
      day.rows.find((row) => row.job.id === primary.id && row.active)?.job.id ??
        day.rows.find((row) => row.active || row.payday)?.job.id ??
        day.rows[0]?.job.id ??
        "personal",
    );
    setError("");
  }
  function move(n: number) {
    const next = new Date(month + "-01T00:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + n);
    const m = next.toISOString().slice(0, 7);
    if (m >= "2000-01" && m <= "2099-12") setMonth(m);
  }
  async function act(fn: () => Promise<unknown>, close = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (close) setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
          <div className="calendar-tools">
            {jobs.length > 1 && (
              <select
                aria-label="日历工作筛选"
                value={selectedFilter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">全部工作</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="secondary"
              onClick={() => setMonth(today.slice(0, 7))}
            >
              回到本月
            </button>
          </div>
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
          {days.map((day) => {
            const { date, rows, workday, plans } = day;
            const multiple = all && jobs.length > 1;
            const info = rows[0]?.info,
              hasPayday = rows.some((row) => row.payday);
            const usdRows = rows.filter(
              (row) => row.active && row.job.currency === "USD",
            );
            const usdTotal = usdRows.reduce(
              (sum, row) => sum + row.income.nativeCents,
              0,
            );
            const label =
              rows.length === 1 && info?.paidHoliday
                ? info.paidHoliday
                : workday
                  ? "工作日"
                  : "休息日";
            return (
              <button
                key={date}
                aria-label={date + " " + label}
                className={[
                  "day",
                  workday ? "work" : "rest",
                  date === today && "today",
                  rows.some((row) => row.info?.source === "manual") && "manual",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => openDay(day)}
              >
                <span>{Number(date.slice(-2))}</span>
                {multiple ? (
                  <div className="calendar-job-list">
                    {rows.slice(0, 2).map((row) => (
                      <small
                        key={row.job.id}
                        title={row.job.name + " · " + rowStatus(row, date)}
                      >
                        <span
                          className="job-dot"
                          style={{ backgroundColor: row.job.color }}
                        />
                        {row.job.name} · {rowStatus(row, date)}
                      </small>
                    ))}
                    {rows.length > 2 && (
                      <small>另有 {rows.length - 2} 份</small>
                    )}
                  </div>
                ) : (
                  rows[0] && <small>{rowStatus(rows[0], date)}</small>
                )}
                <span
                  className="day-income"
                  title={
                    date < today
                      ? "已结算收入"
                      : date === today
                        ? "今日目前收入"
                        : "预计全天收入"
                  }
                >
                  {daySummary(rows, date, today)}
                </span>
                {usdRows.length > 0 &&
                  !rows.some(
                    (row) =>
                      row.income.cnyCents === null &&
                      row.income.nativeCents > 0,
                  ) && (
                    <small className="calendar-native">
                      {nativeMoney(usdTotal, "USD")}
                    </small>
                  )}
                {hasPayday && (
                  <small className="payday-marker">
                    发薪日
                    {rows.every((row) => !row.payday || row.payday.received)
                      ? " · 已到账"
                      : ""}
                  </small>
                )}
                {rows.some((row) => row.scope.leaves?.[date]?.length) && (
                  <small className="leave-badge">已安排请假</small>
                )}
                {date === today && <i>今天</i>}
                {plans.length > 0 && (
                  <span className="day-plans">
                    计划 {plans.filter((p) => p.completed).length}/
                    {plans.length}
                  </span>
                )}
              </button>
            );
          })}
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
        </div>
      </section>
      <section className="calendar-foot">
        <p className="muted">
          {year
            ? month.slice(0, 4) + " 年节假日日历 · 更新于 " + year.updated
            : "节假日数据缺失，当前按常规排班"}
          <br />
          历史排班变更后可在收入记录中重算。请假扣款即时更新。
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act(() => window.buddy.importCalendar())}
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
      {selected && selectedDay && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected + " 工作计划"}
            className="modal card plan-modal"
          >
            <button
              aria-label="关闭"
              className="modal-close"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
            <h2>{selected} 怎么安排？</h2>
            <div
              className="day-job-choices"
              role="group"
              aria-label="日期明细与编辑对象"
            >
              {selectedDay.rows.map((row) => (
                <button
                  key={row.job.id}
                  aria-pressed={owner === row.job.id}
                  disabled={busy}
                  onClick={() => {
                    setOwner(row.job.id);
                    setError("");
                  }}
                >
                  <span>
                    <span
                      className="job-dot"
                      style={{ backgroundColor: row.job.color }}
                    />
                    {row.job.name}
                  </span>
                  <small>
                    {rowStatus(row, selected)}
                    {row.payday && " · 发薪日"}
                  </small>
                  <strong>
                    {nativeMoney(row.income.nativeCents, row.job.currency)}
                    {row.job.currency === "USD" && <> · {converted(row)}</>}
                  </strong>
                </button>
              ))}
              <button
                aria-pressed={personal}
                disabled={busy}
                onClick={() => {
                  setOwner("personal");
                  setError("");
                }}
              >
                个人计划
              </button>
            </div>
            {current && (
              <>
                {current.job.currency === "USD" && current.active && (
                  <p className="job-fx-note">
                    {current.income.rate !== null && current.income.rateDate
                      ? (current.income.provisional
                          ? "暂估汇率"
                          : "人民币汇率中间价") +
                        " · " +
                        current.income.rateDate +
                        " · US$1 = ¥" +
                        current.income.rate
                      : "汇率待获取，美元收入已保留。"}
                  </p>
                )}
                {current.payday && (
                  <div className="job-payout">
                    <div>
                      <h3>
                        双周发薪 ·{" "}
                        {nativeMoney(
                          current.payday.expectedCents,
                          current.job.currency,
                        )}
                      </h3>
                      <small>
                        {current.payday.start} 至 {current.payday.end}
                      </small>
                    </div>
                    {selected <= today ? (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act(() =>
                            window.buddy.setPaydayReceived(
                              current.job.id,
                              selected,
                              !current.payday!.received,
                            ),
                          )
                        }
                      >
                        {current.payday.received ? "撤销已到账" : "标记已到账"}
                      </button>
                    ) : (
                      <span>待发薪</span>
                    )}
                  </div>
                )}
                {current.active && (
                  <LeaveEditor
                    key={selected + owner}
                    state={current.scope}
                    date={selected}
                    jobId={owner}
                    currency={current.job.currency}
                    busy={busy}
                    setBusy={setBusy}
                  />
                )}
              </>
            )}
            {(personal ||
              current?.active ||
              Boolean(current?.scope.plans[selected]?.length)) && (
              <CalendarPlans
                key={selected + owner + "plans"}
                date={selected}
                ownerId={personal ? "personal" : owner}
                plans={
                  personal
                    ? (state.personalPlans?.[selected] ?? [])
                    : (current?.scope.plans[selected] ?? [])
                }
                busy={busy}
                setBusy={setBusy}
              />
            )}
            {current?.active && (
              <>
                <hr className="plan-divider" />
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          window.buddy.setDayOverride(selected, true, owner),
                        true,
                      )
                    }
                  >
                    设为工作日
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          window.buddy.setDayOverride(selected, false, owner),
                        true,
                      )
                    }
                  >
                    设为休息日
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          window.buddy.setDayOverride(selected, null, owner),
                        true,
                      )
                    }
                  >
                    恢复自动判断
                  </button>
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
