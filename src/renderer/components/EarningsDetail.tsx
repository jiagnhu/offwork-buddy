import { useState } from "react";
import { earningsDetail } from "../../core/earnings-detail";
import { jobState, listJobs, primaryJob } from "../../core/jobs";
import { combinedDayIncome, jobDayIncome } from "../../core/work-income";
import type { Snapshot } from "../../shared/model";
import { combinedMoney, money, nativeMoney, time } from "./format";
export default function EarningsDetail({
  date,
  jobId,
  snapshot,
  onClose,
  onLedger,
}: {
  date: string;
  jobId?: string;
  snapshot: Snapshot;
  onClose: () => void;
  onLedger: () => void;
}) {
  const { state } = snapshot,
    jobs = listJobs(state);
  const [selection, setSelection] = useState(
    jobId ?? (jobs.length === 1 ? primaryJob(state).id : "all"),
  );
  const job = jobs.find((j) => j.id === selection);
  const now = new Date();
  const scoped = job ? jobState(state, job.id) : null;
  const detail = scoped ? earningsDetail(scoped, date, now) : null;
  const income = job ? jobDayIncome(state, job.id, date, now) : null;
  const total = combinedDayIncome(state, date, now);
  const currency = job?.currency ?? "CNY";
  const unit = currency === "USD" ? "美元" : "元";
  const rule =
    detail?.kind === "day"
      ? detail.rule
      : detail?.kind === "historical"
        ? detail.entry.rule
        : null;
  const amount = income?.nativeCents ?? 0;
  const denominator =
    detail?.kind === "day"
      ? detail.detail.denominator
      : detail?.kind === "historical"
        ? detail.entry.workdayCount
        : null;
  return (
    <div className="modal-backdrop">
      <section
        className="modal card plan-modal"
        role="dialog"
        aria-modal="true"
        aria-label="工资计算明细"
      >
        <button className="modal-close" aria-label="关闭明细" onClick={onClose}>
          ×
        </button>
        <h2>{date} 工资明细</h2>
        {jobs.length > 1 && (
          <label>
            查看工作{" "}
            <select
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
          </label>
        )}
        {!job && (
          <>
            <strong className="stat-value">
              {combinedMoney(total.cnyCents, total.pendingUsdCents)}
            </strong>
            {jobs.map((j) => {
              const row = jobDayIncome(state, j.id, date, now);
              return (
                <button
                  className="work-income-row"
                  key={j.id}
                  onClick={() => setSelection(j.id)}
                >
                  <span>
                    <i className="work-dot" style={{ background: j.color }} />
                    {j.name}
                  </span>
                  <span>
                    {nativeMoney(row.nativeCents, j.currency)}{" "}
                    {j.currency === "USD" && (
                      <small>
                        {row.cnyCents === null
                          ? "待折算"
                          : "≈ ¥" + money(row.cnyCents)}
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </>
        )}
        {detail?.kind === "unconfigured" ? (
          <p>
            该日期没有适用的工资规则，可在偏好设置中查看这份工作的起止日期。
          </p>
        ) : (
          rule && (
            <>
              <strong className="stat-value">
                {nativeMoney(amount, currency)}
              </strong>
              {currency === "USD" && income && (
                <p>
                  {income.rate && income.cnyCents !== null
                    ? `约 ¥${money(income.cnyCents)} · 1 美元 = ${income.rate} 元（${income.rateDate} 中间价${income.provisional ? "，暂估" : ""}）· 来源：国家外汇管理局`
                    : "待获取当日汇率"}
                </p>
              )}
              <p>
                {rule.mode === "monthly"
                  ? denominator === null
                    ? "休息日不计预计收入"
                    : `月薪 ${rule.amount} ${unit} ÷ ${denominator} 天`
                  : rule.mode === "biweekly"
                    ? `每两周 ${rule.amount} ${unit}，按本期计薪日分摊${denominator ? "（" + denominator + " 天）" : ""}`
                    : rule.mode === "daily"
                      ? `日薪 ${rule.amount} ${unit}`
                      : `时薪 ${rule.amount} ${unit} × 有效工作小时`}
              </p>
              <p className="muted">
                作息 {time(rule.start)}–{time(rule.end)} · 午休{" "}
                {rule.breakStart === null
                  ? "未设置"
                  : `${time(rule.breakStart)}–${time(rule.breakEnd!)}`}
              </p>
              {detail?.kind === "day" && (
                <>
                  <p>
                    未扣请假日薪：
                    {Number(detail.detail.dailyBudgetDecimal).toFixed(4)} {unit}
                  </p>
                  <p>
                    已计工时 {(detail.detail.elapsedSeconds / 3600).toFixed(4)}{" "}
                    / {(detail.detail.totalSeconds / 3600).toFixed(2)} 小时
                  </p>
                  <p className="muted">
                    {detail.detail.dayInfo.paidHoliday
                      ? `${detail.detail.dayInfo.paidHoliday}：带薪休息，按正常每日预算计入，不按工作小时累计。`
                      : detail.detail.dayInfo.workday
                        ? "当前金额 = 未提前舍入的正常日薪 × 扣除已过请假后的工时比例。午休、请假暂停累计。"
                        : `今日休息，由${{ manual: "手动安排", official: "节假日日历", schedule: "每周排班" }[detail.detail.dayInfo.source]}确定。`}
                  </p>
                </>
              )}
              {detail?.kind === "historical" && (
                <>
                  <p>
                    {detail.explanation.algorithm === "historical"
                      ? "历史结算（未记录算法版本）"
                      : rule.mode === "biweekly"
                        ? "按双周计薪日分摊"
                        : "正常周排班算法"}
                  </p>
                  <p>
                    当天{detail.entry.workday ? "工作" : "休息"} ·
                    按保存的记录展示
                  </p>
                  {detail.explanation.differs && (
                    <p className="notice">
                      历史分母为 {denominator} 天，正常排班为{" "}
                      {detail.explanation.normalDenominator}{" "}
                      天。需要调整可到收入记录主动重算。
                    </p>
                  )}
                </>
              )}
              <p>
                请假扣薪：
                {detail?.kind === "day"
                  ? detail.detail.leaveMinutes
                  : detail?.kind === "historical"
                    ? (detail.entry.leaveMinutes ?? 0)
                    : 0}{" "}
                分钟 · 全天扣减 {currency === "USD" ? "US$" : "¥"}
                {money(
                  detail?.kind === "day"
                    ? detail.detail.leaveDeductionCents
                    : detail?.kind === "historical"
                      ? (detail.entry.leaveDeductionCents ?? 0)
                      : 0,
                )}
              </p>
              <p className="hint">
                金额每天四舍五入到分再累计；含日历标注的法定节假日正常工资；不含税费、其他带薪假期和加班费。
              </p>
            </>
          )
        )}
        <hr className="plan-divider" />
        <h3>累计拆分</h3>
        <p>
          已结算{" "}
          {combinedMoney(
            snapshot.settledCents,
            snapshot.incomeTotals?.settledPendingUsd ?? 0,
          )}{" "}
          · 今日{" "}
          {combinedMoney(
            snapshot.totalCents - snapshot.settledCents,
            snapshot.incomeTotals?.todayPendingUsd ?? 0,
          )}
        </p>
        <p className="muted">
          全部工作合计{" "}
          {combinedMoney(
            snapshot.totalCents,
            (snapshot.incomeTotals?.settledPendingUsd ?? 0) +
              (snapshot.incomeTotals?.todayPendingUsd ?? 0),
          )}
        </p>
        <button className="secondary" onClick={onLedger}>
          查看每日记录 / 重算
        </button>
      </section>
    </div>
  );
}
