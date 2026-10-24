import { useState } from "react";
import { Wallet, RotateCcw, Download } from "lucide-react";
import type { Snapshot } from "../../shared/model";
import { money } from "../components/format";
import { addDays } from "../../core/date";
export default function Ledger({ snapshot }: { snapshot: Snapshot }) {
  const [month, setMonth] = useState(snapshot.today.slice(0, 7)),
    [from, setFrom] = useState(snapshot.state.startDate),
    [to, setTo] = useState(addDays(snapshot.today, -1)),
    [error, setError] = useState("");
  const entries = Object.values(snapshot.state.ledger)
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="ledger-hero card">
        <div>
          <h2>收入累计</h2>
          <p className="muted">从 {snapshot.state.startDate} 起累计</p>
        </div>
        <div>
          <span className="muted">已结算累计</span>
          <strong>¥ {money(snapshot.settledCents)}</strong>
        </div>
        <Wallet size={44} />
      </div>
      <section className="card">
        <div className="section-title">
          <h2>每日收入记录</h2>
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
              <th>当天排班</th>
              <th>计薪方式</th>
              <th>预计收入</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.date}>
                <td>{e.date}</td>
                <td>
                  <span className={`pill ${e.workday ? "" : "rest-pill"}`}>
                    {e.workday ? "工作日" : "休息日"}
                  </span>
                </td>
                <td>
                  {
                    {
                      monthly: "固定月薪",
                      daily: "按天计薪",
                      hourly: "按小时计薪",
                    }[e.rule.mode]
                  }
                </td>
                <td className="money-cell">
                  <button
                    className="money-link"
                    onClick={() =>
                      window.buddy.openPanel({ page: "earnings", date: e.date })
                    }
                  >
                    ¥ {money(e.amountCents)}
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
          <strong>
            ¥ {money(entries.reduce((s, e) => s + e.amountCents, 0))}
          </strong>
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
          <input
            aria-label="重算开始"
            type="date"
            value={from}
            min={snapshot.state.startDate}
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
                await window.buddy.recalculate(from, to);
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
