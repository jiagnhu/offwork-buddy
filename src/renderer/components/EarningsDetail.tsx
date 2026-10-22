import { useEffect, useState } from "react";
import type { EarningsDetail as Detail } from "../../core/earnings-detail";
import type { Snapshot } from "../../shared/model";
import { money, time } from "./format";
export default function EarningsDetail({
  date,
  snapshot,
  onClose,
  onLedger,
}: {
  date: string;
  snapshot: Snapshot;
  onClose: () => void;
  onLedger: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    window.buddy
      .getEarningsDetail(date)
      .then((d) => {
        if (live) setDetail(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [
    date,
    snapshot.progress.earnedCents,
    snapshot.state.ledger[date]?.amountCents,
    JSON.stringify(snapshot.state.rules),
    JSON.stringify(snapshot.state.overrides),
  ]);
  const rule =
    detail?.kind === "day"
      ? detail.rule
      : detail?.kind === "historical"
        ? detail.entry.rule
        : null;
  const amount =
    detail?.kind === "day"
      ? detail.detail.progress.earnedCents
      : detail?.kind === "historical"
        ? detail.entry.amountCents
        : 0;
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
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!detail && !error && <p>正在读取记录…</p>}
        {detail?.kind === "unconfigured" ? (
          <p>该日期尚未开始计薪，请检查累计开始日期和工资设置。</p>
        ) : (
          rule && (
            <>
              <strong className="stat-value">¥ {money(amount)}</strong>
              <p>
                {rule.mode === "monthly"
                  ? denominator === null
                    ? "休息日不计预计收入"
                    : `月薪 ${rule.amount} 元 ÷ ${denominator} 天`
                  : rule.mode === "daily"
                    ? `日薪 ${rule.amount} 元`
                    : `时薪 ${rule.amount} 元 × 有效工作小时`}
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
                    每日预算：
                    {Number(detail.detail.dailyBudgetDecimal).toFixed(4)} 元
                  </p>
                  <p>
                    已计工时 {(detail.detail.elapsedSeconds / 3600).toFixed(4)}{" "}
                    / {(detail.detail.totalSeconds / 3600).toFixed(2)} 小时
                  </p>
                  <p className="muted">
                    {detail.detail.dayInfo.paidHoliday
                      ? `${detail.detail.dayInfo.paidHoliday}：带薪休息，按正常每日预算计入，不按工作小时累计。`
                      : detail.detail.dayInfo.workday
                        ? "今日金额 = 未提前舍入的每日预算 × 已计工时比例。午休暂停累计。"
                        : `今日休息，由${{ manual: "手动安排", official: "节假日日历", schedule: "每周排班" }[detail.detail.dayInfo.source]}确定。`}
                  </p>
                </>
              )}
              {detail?.kind === "historical" && (
                <>
                  <p>
                    {detail.explanation.algorithm === "historical"
                      ? "历史结算（未记录算法版本）"
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
              <p className="hint">
                金额每天四舍五入到分再累计；含日历标注的法定节假日正常工资；不含税费、其他带薪假期和加班费。
              </p>
            </>
          )
        )}
        <hr className="plan-divider" />
        <h3>累计拆分</h3>
        <p>
          已结算 ¥ {money(snapshot.settledCents)} + 今日 ¥{" "}
          {money(snapshot.totalCents - snapshot.settledCents)} = ¥{" "}
          {money(snapshot.totalCents)}
        </p>
        <p className="muted">从 {snapshot.state.startDate} 开始</p>
        <button className="secondary" onClick={onLedger}>
          查看每日记录 / 重算
        </button>
      </section>
    </div>
  );
}
