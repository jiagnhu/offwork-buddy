import { useState } from "react";
import { Wallet, RotateCcw, Download } from "lucide-react";
import type { Snapshot } from "../../shared/model";
import { combinedMoney, nativeMoney } from "../components/format";
import { jobState, listJobs, primaryJob } from "../../core/jobs";
import { jobDayIncome } from "../../core/work-income";
import { addDays } from "../../core/date";
export default function Ledger({ snapshot }: { snapshot: Snapshot }) {
  const { state } = snapshot;
  const jobs = listJobs(state);
  const [selection, setSelection] = useState("all");
  const selectedJobs =
    selection === "all" ? jobs : jobs.filter((j) => j.id === selection);
  const [recalcId, setRecalcId] = useState(primaryJob(state).id);
  const recalcJob = jobs.find((j) => j.id === recalcId) ?? primaryJob(state);
  const [month, setMonth] = useState(snapshot.today.slice(0, 7)),
    [from, setFrom] = useState(snapshot.state.startDate),
    [to, setTo] = useState(addDays(snapshot.today, -1)),
    [error, setError] = useState("");
  const now = new Date();
  const entries = selectedJobs
    .flatMap((job) =>
      Object.values(jobState(state, job.id).ledger)
        .filter((e) => e.date.startsWith(month))
        .map((entry) => ({
          entry,
          job,
          income: jobDayIncome(state, job.id, entry.date, now),
        })),
    )
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date));
  const monthTotal = entries.reduce(
    (sum, { income }) => ({
      cny: sum.cny + (income.cnyCents ?? 0),
      pending:
        sum.pending + (income.cnyCents === null ? income.nativeCents : 0),
    }),
    { cny: 0, pending: 0 },
  );
  return (
    <>
      <div className="ledger-hero card">
        <div>
          <h2>收入累计</h2>
          <p className="muted">
            从 {jobs.map((j) => j.startDate).sort()[0]} 起累计
          </p>
        </div>
        <div>
          <span className="muted">全部工作已结算累计</span>
          <strong>
            {combinedMoney(
              snapshot.settledCents,
              snapshot.incomeTotals?.settledPendingUsd ?? 0,
            )}
          </strong>
        </div>
        <Wallet size={44} />
      </div>
      <section className="card">
        <div className="section-title">
          <h2>每日收入记录</h2>
          {jobs.length > 1 && (
            <select
              aria-label="筛选收入记录工作"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="all">全部工作</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label="查看月份"
            type="month"
            min="2000-01"
            max="2099-12"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              {jobs.length > 1 && <th>工作</th>}
              <th>当天排班</th>
              <th>计薪方式</th>
              <th>预计收入</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ entry: e, job, income }) => (
              <tr key={job.id + e.date}>
                <td>{e.date}</td>
                {jobs.length > 1 && (
                  <td>
                    <i className="work-dot" style={{ background: job.color }} />
                    {job.name}
                  </td>
                )}
                <td>
                  <span className={`pill ${e.workday ? "" : "rest-pill"}`}>
                    {e.calendarSnapshot.paidHoliday
                      ? "带薪休假"
                      : e.workday
                        ? "工作日"
                        : "休息日"}
                  </span>
                </td>
                <td>
                  {
                    {
                      monthly: "固定月薪",
                      biweekly: "双周固定薪酬",
                      daily: "按天计薪",
                      hourly: "按小时计薪",
                    }[e.rule.mode]
                  }
                </td>
                <td className="money-cell">
                  <button
                    className="money-link"
                    onClick={() =>
                      window.buddy.openPanel({
                        page: "earnings",
                        date: e.date,
                        jobId: job.id,
                      })
                    }
                  >
                    {nativeMoney(e.amountCents, job.currency)}
                    {job.currency === "USD" && (
                      <small className="ledger-fx">
                        {income.cnyCents === null
                          ? "待折算"
                          : "≈ " + nativeMoney(income.cnyCents, "CNY")}
                      </small>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="empty-state">
            <Wallet size={36} />
            <h3>让积累，从今天开始</h3>
            <p>每天结束后会自动结算；关机期间也会按排班补算。</p>
          </div>
        )}
        <div className="table-total">
          本月已结算{" "}
          <strong>{combinedMoney(monthTotal.cny, monthTotal.pending)}</strong>
        </div>
      </section>
      <details className="card advanced">
        <summary>
          <RotateCcw size={16} />
          调整历史记录
        </summary>
        <p className="muted">
          修改过历史日历或升级了计薪算法？可主动重算指定日期。月薪将按正常周排班天数分摊，执行前会再次确认。
        </p>
        <div className="button-row">
          {jobs.length > 1 && (
            <select
              aria-label="重算哪份工作"
              value={recalcJob.id}
              onChange={(e) => {
                setRecalcId(e.target.value);
                setFrom(jobs.find((j) => j.id === e.target.value)!.startDate);
              }}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label="重算开始"
            type="date"
            value={from}
            min={recalcJob.startDate}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>至</span>
          <input
            aria-label="重算结束"
            type="date"
            value={to}
            min={from}
            max={addDays(snapshot.today, -1)}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            className="secondary"
            onClick={async () => {
              try {
                await window.buddy.recalculate(from, to, recalcJob.id);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            重算记录
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </details>
    </>
  );
}
