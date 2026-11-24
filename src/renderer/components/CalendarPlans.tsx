import { useState } from "react";
import { X } from "lucide-react";
import type { PlanAction } from "../../core/plans";
import type { DailyPlan } from "../../shared/model";

export function CalendarPlans({
  date,
  ownerId,
  plans,
  busy,
  setBusy,
}: {
  date: string;
  ownerId: string;
  plans: DailyPlan[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  async function savePlans(action: PlanAction) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await window.buddy.updatePlan(date, action, ownerId);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="plan-heading">
        <h3>{ownerId === "personal" ? "个人计划" : "每日工作计划"}</h3>
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
          <li key={plan.id} className={plan.completed ? "plan-completed" : ""}>
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
              onClick={() => void savePlans({ type: "delete", id: plan.id })}
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
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
