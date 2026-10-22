import type { State } from "../shared/model";
import { dateKey } from "./date";
import { ruleForDate } from "./ledger";
import { resolveDay } from "./calendar";
export interface ReminderCandidate {
  key: string;
  kind:
    "lunch-before" | "lunch-now" | "offwork-before" | "offwork-now" | "rest";
  at: number;
  text: string;
}
export function dueReminders(
  state: State,
  previous: Date,
  now: Date,
): ReminderCandidate[] {
  const date = dateKey(now),
    rule = ruleForDate(state, date),
    p = state.preferences.reminders;
  if (
    !state.configured ||
    date < state.startDate ||
    !rule ||
    now <= previous ||
    !resolveDay(date, rule, state.calendar, state.overrides).workday
  )
    return [];
  const base = new Date(`${date}T00:00:00+08:00`).getTime(),
    items: ReminderCandidate[] = [];
  function target(type: "lunch" | "offwork", minute: number) {
    const at = base + minute * 60000;
    items.push({
      key: `${date}:${type}-now:${at}`,
      kind: `${type}-now`,
      at,
      text:
        type === "lunch"
          ? "到午休时间啦，先去好好吃饭吧。"
          : "下班啦！今天辛苦了，去享受自己的时间吧。",
    });
    if (p.leadMinutes)
      items.push({
        key: `${date}:${type}-before:${at}`,
        kind: `${type}-before`,
        at: at - p.leadMinutes * 60000,
        text: `还有 ${p.leadMinutes} 分钟${type === "lunch" ? "午休" : "下班"}，可以准备收尾啦。`,
      });
  }
  if (p.lunch && rule.breakStart !== null) target("lunch", rule.breakStart);
  if (p.offwork) target("offwork", rule.end);
  const interval = p.restMinutes ?? 0;
  if (Number.isInteger(interval) && interval >= 5 && interval <= 240) {
    const segments =
      rule.breakStart !== null && rule.breakEnd !== null
        ? [
            [rule.start, rule.breakStart],
            [rule.breakEnd, rule.end],
          ]
        : [[rule.start, rule.end]];
    for (const [start, end] of segments) {
      if (
        now.getTime() < base + start * 60000 ||
        now.getTime() >= base + end * 60000
      )
        continue;
      for (let minute = start + interval; minute < end; minute += interval) {
        const at = base + minute * 60000;
        items.push({
          key: `${date}:rest:${at}`,
          kind: "rest",
          at,
          text: `已经忙了 ${interval} 分钟，看看远处、伸个懒腰吧。`,
        });
      }
    }
  }
  return items
    .filter(
      (i) =>
        i.at > previous.getTime() &&
        i.at <= now.getTime() &&
        now.getTime() - i.at <= 60000 &&
        !Object.hasOwn(state.reminderHistory, i.key),
    )
    .sort((a, b) => a.at - b.at);
}
