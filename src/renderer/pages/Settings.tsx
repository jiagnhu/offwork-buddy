import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  Check,
  Download,
  Upload,
  Sun,
  Moon,
  Heart,
  Plus,
} from "lucide-react";
import type { Snapshot, RuleInput } from "../../shared/model";
import { defaultRule } from "../../shared/defaults";
import { addDays, validDate } from "../../core/date";
import { jobState, listJobs, primaryJob } from "../../core/jobs";
import { time, toMinutes } from "../components/format";
import { RestReminderSetting } from "../components/CompanionSettings";
import "../styles/multi-jobs.css";

const jobColors = ["#ed8b3d", "#45a8c5", "#af84dd", "#6fb177", "#e4799c"];

export function WorkForm({
  snapshot,
  onDone,
  onboarding = false,
  selection,
}: {
  snapshot: Snapshot;
  onDone?: (id: string) => void;
  onboarding?: boolean;
  selection?: string;
}) {
  const creating = selection === "new";
  const jobs = listJobs(snapshot.state);
  const job = creating
    ? undefined
    : (jobs.find((j) => j.id === selection) ?? primaryJob(snapshot.state));
  const initialColor =
    job?.color ??
    jobColors.find((color) => jobs.every((j) => j.color !== color)) ??
    jobColors[jobs.length % jobColors.length];
  const scope = job ? jobState(snapshot.state, job.id) : undefined;
  const initialRule = scope?.rules.at(-1) ?? {
    ...defaultRule(),
    official: !creating,
  };
  const [rule, setRule] = useState<RuleInput>(initialRule),
    [name, setName] = useState(job?.name ?? ""),
    [color, setColor] = useState(initialColor),
    [currency, setCurrency] = useState<"CNY" | "USD">(job?.currency ?? "CNY"),
    [startDate, setStartDate] = useState(job?.startDate ?? snapshot.today),
    [endDate, setEndDate] = useState(job?.endDate ?? ""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const persistedForm = JSON.stringify({
    rule: initialRule,
    startDate: job?.startDate ?? snapshot.today,
    endDate: job?.endDate ?? "",
    name: job?.name ?? "",
    color: initialColor,
    currency: job?.currency ?? "CNY",
  });
  useEffect(() => {
    const next = JSON.parse(persistedForm);
    setRule(next.rule);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setName(next.name);
    setColor(next.color);
    setCurrency(next.currency);
    setError("");
  }, [persistedForm]);
  function field<K extends keyof RuleInput>(key: K, value: RuleInput[K]) {
    setRule((r) => ({ ...r, [key]: value }));
    setSaved(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const next = await window.buddy.saveJob({
        id: job?.id,
        rule,
        startDate,
        endDate: endDate || undefined,
        name: name.trim(),
        color,
        currency,
      });
      setSaved(true);
      const savedJob =
        job ??
        listJobs(next.state).find(
          (j) =>
            !listJobs(snapshot.state).some((previous) => previous.id === j.id),
        );
      if (savedJob) onDone?.(savedJob.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      onChange={() => setSaved(false)}
      className="work-form"
    >
      <div className="form-grid">
        <label>
          工作名称
          <input
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：主业、周末兼职"
          />
        </label>
        <label>
          标识颜色
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label>
          计薪方式
          <select
            value={rule.mode}
            onChange={(e) => {
              const mode = e.target.value as RuleInput["mode"];
              const { periodStart, payDate, ...base } = rule;
              if (mode === "biweekly") {
                const anchor =
                  periodStart ||
                  (validDate(startDate) ? startDate : snapshot.today);
                setRule({
                  ...base,
                  mode,
                  periodStart: anchor,
                  payDate: payDate ?? addDays(anchor, 13),
                });
              } else setRule({ ...base, mode });
            }}
          >
            <option value="monthly">固定月薪</option>
            <option value="biweekly">每两周固定金额</option>
            <option value="daily">按天计薪</option>
            <option value="hourly">按小时计薪</option>
          </select>
        </label>
        <label>
          计薪币种
          <select
            value={currency}
            disabled={Boolean(scope?.configured)}
            onChange={(e) => setCurrency(e.target.value as "USD" | "CNY")}
          >
            <option value="CNY">人民币 CNY</option>
            <option value="USD">美元 USD</option>
          </select>
        </label>
        <label>
          工资金额
          <div className="input-affix">
            <span>{currency === "USD" ? "US$" : "¥"}</span>
            <input
              aria-label="工资金额"
              type="number"
              min="0"
              max="100000000"
              step="0.01"
              required
              value={rule.amount === "0" ? "" : rule.amount}
              placeholder="输入你的工资"
              onChange={(e) => field("amount", e.target.value)}
            />
            <span>
              {rule.mode === "monthly"
                ? "/ 月"
                : rule.mode === "biweekly"
                  ? "/ 两周"
                  : rule.mode === "daily"
                    ? "/ 天"
                    : "/ 小时"}
            </span>
          </div>
        </label>
        {rule.mode === "biweekly" && (
          <>
            <label>
              计薪周期开始日
              <input
                type="date"
                min="2000-01-01"
                max="2099-12-31"
                required
                value={rule.periodStart ?? ""}
                onChange={(e) => field("periodStart", e.target.value)}
              />
            </label>
            <label>
              该期发薪日
              <input
                type="date"
                min={rule.periodStart || "2000-01-01"}
                max="2099-12-31"
                required
                value={rule.payDate ?? ""}
                onChange={(e) => field("payDate", e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          上班时间
          <input
            type="time"
            required
            value={time(rule.start)}
            onChange={(e) => field("start", toMinutes(e.target.value))}
          />
        </label>
        <label>
          下班时间
          <input
            type="time"
            required
            value={time(rule.end)}
            onChange={(e) => field("end", toMinutes(e.target.value))}
          />
        </label>
      </div>
      <label className="checkline">
        <input
          type="checkbox"
          checked={rule.breakStart !== null}
          onChange={(e) =>
            setRule({
              ...rule,
              breakStart: e.target.checked ? 720 : null,
              breakEnd: e.target.checked ? 780 : null,
            })
          }
        />
        午休时暂停工资增长
      </label>
      {rule.breakStart !== null && (
        <div className="form-grid">
          <label>
            午休开始
            <input
              type="time"
              required
              value={time(rule.breakStart)}
              onChange={(e) => field("breakStart", toMinutes(e.target.value))}
            />
          </label>
          <label>
            午休结束
            <input
              type="time"
              required
              value={time(rule.breakEnd!)}
              onChange={(e) => field("breakEnd", toMinutes(e.target.value))}
            />
          </label>
        </div>
      )}
      <div className="form-grid">
        <label>
          每周排班
          <select
            value={rule.schedule}
            onChange={(e) =>
              field("schedule", e.target.value as RuleInput["schedule"])
            }
          >
            <option value="double">双休 · 周六日休息</option>
            <option value="single">单休</option>
            <option value="alternating">大小周 · 隔周周六上班</option>
          </select>
        </label>
        <label>
          累计开始日期
          <input
            type="date"
            min="2000-01-01"
            max={scope?.configured ? job?.startDate : "2099-12-31"}
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        {!onboarding && (
          <label>
            结束日期（选填）
            <input
              type="date"
              min={startDate}
              max="2099-12-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        )}
        {rule.schedule === "single" && (
          <label>
            每周休息日
            <select
              value={rule.restDay}
              onChange={(e) => field("restDay", Number(e.target.value))}
            >
              {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
                <option key={i} value={i}>
                  星期{d}
                </option>
              ))}
            </select>
          </label>
        )}
        {rule.schedule === "alternating" && (
          <label>
            大周基准周一
            <input
              type="date"
              required
              value={rule.bigWeekMonday}
              onChange={(e) => field("bigWeekMonday", e.target.value)}
            />
          </label>
        )}
      </div>
      <label className="checkline">
        <input
          type="checkbox"
          checked={rule.official}
          onChange={(e) => field("official", e.target.checked)}
        />
        采用中国大陆节假日与调休安排
      </label>
      <p className="hint">
        {rule.mode === "biweekly" && (
          <>
            每期 14 天，固定金额按当期计薪日分摊。
            {currency === "USD" && "美元收入按各工作日的汇率折算。"}
            <br />
          </>
        )}
        {rule.mode === "monthly" && (
          <>
            月薪 ÷
            当月正常周排班天数，节假日、补班及手动调班不改变日薪。从累计开始日期估算，含日历标注的法定节假日正常工资，不含其他假期与加班费。
            <br />
          </>
        )}
        {onboarding || creating
          ? "工资仅用于本机预计收入计算，随时可以调整。"
          : "工资与排班变更从明天生效，当前按双周计薪时从下一周期生效。开始日期只可向前扩展。"}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success">
          <Check size={15} /> 工作设置已保存。
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy
          ? "保存中…"
          : onboarding
            ? "开启我的桌面搭子"
            : creating
              ? "创建工作"
              : "保存工作设置"}
        <ArrowUpRight size={18} />
      </button>
    </form>
  );
}
export default function Settings({ snapshot }: { snapshot: Snapshot }) {
  const p = snapshot.state.preferences;
  const jobs = listJobs(snapshot.state),
    primary = primaryJob(snapshot.state);
  const [chosen, setChosen] = useState(primary.id);
  const selection =
    chosen === "new" || jobs.some((job) => job.id === chosen)
      ? chosen
      : primary.id;
  const editing = jobs.find((job) => job.id === selection);
  const [closing, setClosing] = useState(false);
  const [lastDay, setLastDay] = useState(snapshot.today);
  const [jobError, setJobError] = useState("");
  const [jobBusy, setJobBusy] = useState(false);
  function select(id: string) {
    setChosen(id);
    setClosing(false);
    setJobError("");
  }
  async function modifyJob(action: () => Promise<unknown>) {
    if (jobBusy) return;
    setJobBusy(true);
    setJobError("");
    try {
      await action();
      setClosing(false);
    } catch (e) {
      setJobError((e as Error).message);
    } finally {
      setJobBusy(false);
    }
  }
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function act(fn: () => Promise<unknown>) {
    setError("");
    setMessage("");
    try {
      const result = await fn();
      if (result !== false && result !== null) setMessage("已完成");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="settings-layout">
      <section className="card">
        <div className="section-title">
          <div>
            <h2>我的工作</h2>
          </div>
          <button
            className="secondary"
            disabled={jobBusy}
            onClick={() => select("new")}
          >
            <Plus size={16} />
            添加工作
          </button>
        </div>
        <div className="job-tabs" role="group" aria-label="选择工作">
          {jobs.map((job) => (
            <button
              key={job.id}
              disabled={jobBusy}
              aria-pressed={selection === job.id}
              data-archived={Boolean(
                job.endDate && job.endDate < snapshot.today,
              )}
              onClick={() => select(job.id)}
            >
              <span
                className="job-dot"
                style={{ backgroundColor: job.color }}
              />
              {job.name}
              {job.id === primary.id ? " · 主要" : ""}
              {job.endDate &&
                (job.endDate < snapshot.today
                  ? " · 已归档"
                  : job.endDate === snapshot.today
                    ? " · 今天结束"
                    : " · " + job.endDate + " 结束")}
            </button>
          ))}
          {selection === "new" && <button aria-pressed="true">新工作</button>}
        </div>
        <WorkForm
          key={selection}
          snapshot={snapshot}
          selection={selection}
          onDone={select}
        />
        {editing && (
          <div className="job-actions">
            {editing.id !== primary.id &&
              (!editing.endDate || editing.endDate >= snapshot.today) && (
                <button
                  className="secondary"
                  disabled={jobBusy}
                  onClick={() =>
                    modifyJob(() => window.buddy.setPrimaryJob(editing.id))
                  }
                >
                  设为主要工作
                </button>
              )}
            {!editing.endDate && !closing && (
              <button
                className="text-button"
                disabled={jobBusy}
                onClick={() => {
                  setClosing(true);
                  setLastDay(
                    snapshot.today < editing.startDate
                      ? editing.startDate
                      : snapshot.today,
                  );
                }}
              >
                归档工作
              </button>
            )}
            {closing && (
              <form
                className="job-archive-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void modifyJob(() =>
                    window.buddy.archiveJob(editing.id, lastDay),
                  );
                }}
              >
                <label>
                  最后工作日
                  <input
                    type="date"
                    required
                    min={editing.startDate}
                    max="2099-12-31"
                    value={lastDay}
                    onChange={(e) => setLastDay(e.target.value)}
                  />
                </label>
                <p className="muted">
                  收入计算到这一天，历史记录仍可在日历中查看。
                </p>
                <div className="button-row">
                  <button className="secondary" disabled={jobBusy}>
                    确认归档
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={jobBusy}
                    onClick={() => setClosing(false)}
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        {jobError && (
          <p role="alert" className="error">
            {jobError}
          </p>
        )}
      </section>
      <div className="settings-side">
        <section className="card">
          <h2>无声提醒</h2>
          <p className="muted">只用气泡和动作提醒，不播放任何声音。</p>
          {(["lunch", "offwork"] as const).map((key) => (
            <label className="toggle-row" key={key}>
              {key === "lunch" ? "午休提醒" : "下班提醒"}
              <input
                type="checkbox"
                role="switch"
                checked={p.reminders[key]}
                onChange={(e) =>
                  act(() =>
                    window.buddy.setPreferences({
                      reminders: { ...p.reminders, [key]: e.target.checked },
                    }),
                  )
                }
              />
            </label>
          ))}
          <label className="field-title">
            提前提醒
            <select
              aria-label="提前提醒"
              value={p.reminders.leadMinutes}
              onChange={(e) =>
                act(() =>
                  window.buddy.setPreferences({
                    reminders: {
                      ...p.reminders,
                      leadMinutes: Number(e.target.value) as 0 | 5 | 10,
                    },
                  }),
                )
              }
            >
              <option value={0}>仅到点提醒</option>
              <option value={5}>提前 5 分钟</option>
              <option value={10}>提前 10 分钟</option>
            </select>
          </label>
          <RestReminderSetting preferences={p} />
        </section>
        <section className="card">
          <h2>界面与桌面</h2>
          <label className="field-title">界面主题</label>
          <div className="segmented">
            {(["light", "dark"] as const).map((theme) => (
              <button
                key={theme}
                className={p.theme === theme ? "selected" : ""}
                onClick={() =>
                  act(() => window.buddy.setPreferences({ theme }))
                }
              >
                {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}{" "}
                {theme === "light" ? "浅色" : "深色"}
              </button>
            ))}
          </div>
          {(
            [
              ["alwaysOnTop", "桌面伙伴始终置顶"],
              ["reducedMotion", "减少动画"],
              ["autoStart", "开机自动启动"],
            ] as const
          ).map(([key, label]) => (
            <label className="toggle-row" key={key}>
              {label}
              <input
                type="checkbox"
                role="switch"
                checked={p[key]}
                onChange={(e) =>
                  act(() =>
                    window.buddy.setPreferences({ [key]: e.target.checked }),
                  )
                }
              />
            </label>
          ))}
          <label className="field-title">
            伙伴大小 · {Math.round(p.scale * 100)}%
          </label>
          <input
            aria-label="伙伴大小"
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={p.scale}
            onChange={(e) =>
              act(() =>
                window.buddy.setPreferences({ scale: Number(e.target.value) }),
              )
            }
          />
        </section>
        <section className="card">
          <Heart size={20} className="lavender-text" />
          <h2>好好保存每一份努力</h2>
          <p className="muted">
            备份包含工资、计划、私人聊天、角色记忆和故事存档，请妥善保存。
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => act(() => window.buddy.exportBackup())}
            >
              <Download size={16} />
              导出备份
            </button>
            <button
              className="secondary"
              onClick={() => act(() => window.buddy.importBackup())}
            >
              <Upload size={16} />
              导入
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="success">{message}</p>}
        </section>
      </div>
    </div>
  );
}
