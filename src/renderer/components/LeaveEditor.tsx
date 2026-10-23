import { useState } from "react";
import type { State, LeaveInterval } from "../../shared/model";
import { earningsDetail } from "../../core/earnings-detail";
import { money, time } from "./format";
export default function LeaveEditor({
  state,
  date,
  busy,
  setBusy,
}: {
  state: State;
  date: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const [start, setStart] = useState("09:00"),
    [end, setEnd] = useState("12:00"),
    [error, setError] = useState("");
  const periods = state.leaves?.[date] ?? [];
  const detail = earningsDetail(state, date, new Date());
  const deduction =
    detail.kind === "historical"
      ? (detail.entry.leaveDeductionCents ?? 0)
      : detail.kind === "day"
        ? detail.detail.leaveDeductionCents
        : 0;
  const minutes =
    detail.kind === "historical"
      ? (detail.entry.leaveMinutes ?? 0)
      : detail.kind === "day"
        ? detail.detail.leaveMinutes
        : 0;
  const disabled = busy || detail.kind === "unconfigured";
  async function save(next: LeaveInterval[]) {
    if (disabled) return;
    setBusy(true);
    setError("");
    try {
      await window.buddy.setLeave(date, next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const minute = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  return (
    <section className="leave-editor" aria-label="无薪请假">
      <h3>无薪请假</h3>
      <p className="muted">
        仅扣除与工作时间重叠的部分，午休和带薪节假日不扣。保存后立即更新收入。
      </p>
      <form
        className="leave-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save([...periods, { start: minute(start), end: minute(end) }]);
        }}
      >
        <label>
          开始时间
          <input
            required
            aria-label="请假开始时间"
            type="time"
            value={start}
            disabled={disabled}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span>至</span>
        <label>
          结束时间
          <input
            required
            aria-label="请假结束时间"
            type="time"
            value={end}
            disabled={disabled}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={disabled || periods.length >= 24}
        >
          添加请假
        </button>
      </form>
      <ul className="plan-list">
        {periods.map((p, i) => (
          <li key={`${p.start}-${p.end}`}>
            <span>
              {time(p.start)}–{time(p.end)}
            </span>
            <button
              className="text-button"
              disabled={disabled}
              aria-label={`删除请假 ${time(p.start)}–${time(p.end)}`}
              onClick={() => void save(periods.filter((_, n) => n !== i))}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      {periods.length > 0 && (
        <p className="leave-summary">
          扣薪时长 {minutes} 分钟 · 全天扣减 ¥{money(deduction)}
        </p>
      )}
      {detail.kind === "unconfigured" && (
        <p className="muted">请先设置工资，请假日期不能早于入职日期。</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
