import { z } from "zod";
import { validDate, weekday } from "../core/date";
import type { State } from "./model";
export const dateSchema = z
  .string()
  .refine(validDate, "请输入有效日期（2000–2099）");
const minute = z.number().int().min(0).max(1439);
export const ruleInputSchema = z.object({
  mode: z.enum(["monthly", "daily", "hourly"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "金额最多两位小数")
    .refine((v) => Number(v) <= 100000000, "金额不能超过一亿元"),
  start: minute,
  end: minute,
  breakStart: minute.nullable(),
  breakEnd: minute.nullable(),
  schedule: z.enum(["double", "single", "alternating"]),
  restDay: z.number().int().min(0).max(6),
  bigWeekMonday: dateSchema.refine((v) => weekday(v) === 1, "大周基准须为周一"),
  official: z.boolean(),
});
export const ruleSchema = ruleInputSchema
  .extend({ id: z.string().min(1), effectiveFrom: dateSchema })
  .superRefine((r, ctx) => {
    if (r.end <= r.start)
      ctx.addIssue({
        code: "custom",
        message: "下班时间须晚于上班时间，暂不支持跨夜班次",
      });
    if (
      (r.breakStart === null) !== (r.breakEnd === null) ||
      (r.breakStart !== null &&
        r.breakEnd !== null &&
        (r.breakStart < r.start ||
          r.breakEnd > r.end ||
          r.breakEnd <= r.breakStart ||
          r.breakEnd - r.breakStart >= r.end - r.start))
    )
      ctx.addIssue({
        code: "custom",
        message: "午休须在工作时间内，且不能覆盖整个班次",
      });
  });
export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark"]),
  character: z.enum(["pet", "assistant"]),
  reducedMotion: z.boolean(),
  scale: z.number().min(0.75).max(1.25),
  alwaysOnTop: z.boolean(),
  collapsed: z.boolean(),
  autoStart: z.boolean(),
  position: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
});
const dayInfo = z.object({
  workday: z.boolean(),
  source: z.enum(["manual", "official", "schedule"]),
  calendarMissing: z.boolean(),
});
export const calendarYearSchema = z.object({
  source: z.string().url(),
  updated: dateSchema,
  days: z.record(dateSchema, z.boolean()),
});
export const calendarSchema = z
  .record(z.string().regex(/^20\d{2}$/), calendarYearSchema)
  .superRefine((c, ctx) => {
    for (const [year, data] of Object.entries(c))
      if (Object.keys(data.days).some((d) => !d.startsWith(year + "-")))
        ctx.addIssue({ code: "custom", message: "日历日期与年份不一致" });
  });
const entry = z.object({
  date: dateSchema,
  ruleId: z.string(),
  workday: z.boolean(),
  amountCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rule: ruleSchema,
  calendarSnapshot: dayInfo,
  workdayCount: z.number().int().min(0).max(31),
});
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    configured: z.boolean(),
    startDate: dateSchema,
    rules: z.array(ruleSchema).max(40000),
    calendar: calendarSchema,
    overrides: z.record(dateSchema, z.boolean()),
    ledger: z.record(dateSchema, entry),
    preferences: preferencesSchema,
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (s.configured && !s.rules.some((r) => r.effectiveFrom <= s.startDate))
      issue("累计起始日期缺少工资规则");
    if (
      new Set(s.rules.map((r) => r.effectiveFrom)).size !== s.rules.length ||
      new Set(s.rules.map((r) => r.id)).size !== s.rules.length
    )
      issue("工资规则版本重复");
    let total = 0;
    for (const [d, e] of Object.entries(s.ledger)) {
      if (d !== e.date || e.ruleId !== e.rule.id || d < s.startDate)
        issue("收入记录日期或版本不一致");
      total += e.amountCents;
    }
    if (!Number.isSafeInteger(total)) issue("累计金额超出支持范围");
  });
export function parseState(input: unknown): State {
  const state = stateSchema.parse(input);
  state.rules.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return state;
}
