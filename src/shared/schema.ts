import { unlocks } from "../core/growth";
import { z } from "zod";
import { validDate, weekday } from "../core/date";
import type { State } from "./model";
import { migrateV1, migrateV2, migrateV3 } from "./migration";
export const dateSchema = z
  .string()
  .refine(validDate, "请输入有效日期（2000–2099）");
const minute = z.number().int().min(0).max(1439);
export const ruleInputSchema = z.object({
  mode: z.enum(["monthly", "daily", "hourly", "biweekly"]),
  periodStart: dateSchema.optional(),
  payDate: dateSchema.optional(),
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
    if (
      r.mode === "biweekly" &&
      (!r.periodStart || !r.payDate || r.payDate < r.periodStart)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "双周工资须填写计薪周期起始日及对应发薪日，发薪日不能早于周期开始",
      });
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
const legacyPreferencesSchema = z.object({
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
const preferencesV2Schema = legacyPreferencesSchema.extend({
  movementMode: z.enum(["bottom", "stationary"]),
  cardHidden: z.boolean(),
  cardPosition: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  displayId: z.number().finite().optional(),
  reminders: z.object({
    lunch: z.boolean(),
    offwork: z.boolean(),
    leadMinutes: z.union([z.literal(0), z.literal(5), z.literal(10)]),
  }),
  accessory: z.enum(["none", "star", "pillow"]),
});
const characterNickname = z
  .string()
  .trim()
  .min(1, "请输入角色名称")
  .max(20, "名称最多20个字");
export const preferencesSchema = preferencesV2Schema.extend({
  character: z
    .enum([
      "pet",
      "assistant",
      "haru",
      "mao",
      "hiyori",
      "miara",
      "rice",
      "arisa",
      "tororo",
      "hijiki",
    ])
    .transform((kind) =>
      kind === "pet" || kind === "assistant" || kind === "arisa"
        ? ("haru" as const)
        : kind,
    ),
  haruName: characterNickname.default("Haru"),
  characterNames: z
    .object({
      mao: characterNickname.optional(),
      hiyori: characterNickname.optional(),
      miara: characterNickname.optional(),
      rice: characterNickname.optional(),
      arisa: characterNickname.optional(),
      tororo: characterNickname.optional(),
      hijiki: characterNickname.optional(),
    })
    .strict()
    .transform(({ arisa: _retired, ...names }) => names)
    .optional(),
  reminders: preferencesV2Schema.shape.reminders.extend({
    restMinutes: z
      .union([z.literal(0), z.number().int().min(5).max(240)])
      .default(0),
  }),
});
const dayInfo = z.object({
  paidHoliday: z.string().max(40).optional(),
  workday: z.boolean(),
  source: z.enum(["manual", "official", "schedule"]),
  calendarMissing: z.boolean(),
});
export const calendarYearSchema = z.object({
  paidHolidays: z.record(dateSchema, z.string().min(1).max(40)).optional(),
  source: z.string().url(),
  updated: dateSchema,
  days: z.record(dateSchema, z.boolean()),
});
export const calendarSchema = z
  .record(z.string().regex(/^20\d{2}$/), calendarYearSchema)
  .superRefine((c, ctx) => {
    for (const [year, data] of Object.entries(c)) {
      if (
        [
          ...Object.keys(data.days),
          ...Object.keys(data.paidHolidays ?? {}),
        ].some((d) => !d.startsWith(year + "-"))
      )
        ctx.addIssue({ code: "custom", message: "日历日期与年份不一致" });
      if (
        Object.keys(data.paidHolidays ?? {}).some((d) => data.days[d] !== false)
      )
        ctx.addIssue({
          code: "custom",
          message: "带薪节假日必须同时标记为休息日",
        });
    }
  });
export const leaveSchema = z
  .array(
    z
      .object({ start: minute, end: z.number().int().min(1).max(1440) })
      .refine((p) => p.end > p.start, "请假结束时间须晚于开始时间"),
  )
  .max(24);
const entry = z.object({
  fxQuote: z
    .object({
      rate: z.number().finite().positive(),
      rateDate: dateSchema,
      estimated: z.literal(false),
    })
    .optional(),
  baseBudgetDecimal: z
    .string()
    .max(100)
    .regex(/^\d+(\.\d+)?$/)
    .refine((v) => Number(v) <= 2400000000)
    .optional(),
  leaveDeductionCents: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  leaveMinutes: z.number().int().min(0).max(1440).optional(),
  algorithm: z.literal("normal-schedule-v1").optional(),
  date: dateSchema,
  ruleId: z.string(),
  workday: z.boolean(),
  amountCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rule: ruleSchema,
  calendarSnapshot: dayInfo,
  workdayCount: z.number().int().min(0).max(31),
}).refine(e => !e.fxQuote || e.fxQuote.rateDate <= e.date, "锁定汇率日期不能晚于收入日期");
export const planSchema = z.object({
  rewardClaimed: z.boolean().optional(),
  id: z.string().min(1).max(100),
  text: z
    .string()
    .trim()
    .min(1, "请输入计划内容")
    .max(200, "计划最多 200 个字"),
  completed: z.boolean(),
});
export const planActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    id: planSchema.shape.id,
    text: planSchema.shape.text,
  }),
  z.object({
    type: z.literal("complete"),
    id: planSchema.shape.id,
    completed: z.boolean(),
  }),
  z.object({ type: z.literal("delete"), id: planSchema.shape.id }),
]);
export const plansSchema = z

  .array(planSchema)
  .max(100, "每天最多 100 项计划")
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "计划编号重复",
  );
const jobId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,100}$/)
  .refine(
    (id) =>
      !["personal", "all", "__proto__", "constructor", "prototype"].includes(
        id,
      ),
    "工作编号无效",
  );
const jobFields = {
  name: z
    .string()
    .trim()
    .min(1, "请输入工作名称")
    .max(40, "工作名称最多40个字"),
  color: z.string().regex(/^#[\da-f]{6}$/i, "请选择有效的工作颜色"),
  currency: z.enum(["CNY", "USD"]),
  endDate: dateSchema.optional(),
};
const jobMeta = z.object({
  ...jobFields,
  id: jobId,
  receivedPaydays: z.record(dateSchema, z.boolean()),
});
export const jobInputSchema = z.object({
  ...jobFields,
  id: jobId.optional(),
  startDate: dateSchema,
  rule: ruleInputSchema,
});
const jobContents = {
  configured: z.boolean(),
  startDate: dateSchema,
  rules: z.array(ruleSchema).max(40000),
  overrides: z.record(dateSchema, z.boolean()),
  leaves: z.record(dateSchema, leaveSchema).default({}),
  plans: z.record(dateSchema, plansSchema).default({}),
  ledger: z.record(dateSchema, entry),
};
const stateBase = z.object({
  schemaVersion: z.literal(3),
  growth: z.object({
    points: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    days: z.record(
      dateSchema,
      z
        .object({
          interacted: z.boolean(),
          rewardedPlanIds: z.array(z.string()).max(5),
          planRewardCount: z.number().int().min(0).max(5),
        })
        .refine(
          (d) =>
            d.planRewardCount === d.rewardedPlanIds.length &&
            new Set(d.rewardedPlanIds).size === d.rewardedPlanIds.length,
          "成长记录不一致",
        ),
    ),
  }),
  reminderHistory: z.record(z.string().max(160), z.number().finite()),
  ...jobContents,
  calendar: calendarSchema,
  preferences: preferencesSchema,
});
const stateV2Schema = stateBase.extend({
  schemaVersion: z.literal(2),
  preferences: preferencesV2Schema,
});
const legacySchema = stateBase
  .omit({ growth: true, reminderHistory: true })
  .extend({
    schemaVersion: z.literal(1),
    preferences: legacyPreferencesSchema,
  });
export const stateSchema = stateBase
  .extend({
    schemaVersion: z.literal(4),
    primaryJob: jobMeta,
    otherJobs: z.array(jobMeta.extend(jobContents)),
    personalPlans: z.record(dateSchema, plansSchema),
    fxBook: z
      .object({
        rates: z.record(dateSchema, z.number().finite().positive()),
        coverage: z.record(dateSchema, dateSchema).refine(
          ranges => Object.entries(ranges).every(([start, end]) => start <= end),
          "汇率覆盖区间无效",
        ),
      })
      .optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      s.preferences.accessory !== "none" &&
      !unlocks(s.growth.points)[s.preferences.accessory]
    )
      issue("这个配饰尚未解锁");
    const jobs = [{ ...s, ...s.primaryJob }, ...s.otherJobs];
    if (new Set(jobs.map((j) => j.id)).size !== jobs.length)
      issue("工作编号重复");
    for (const job of jobs) {
      if (job.endDate && job.endDate < job.startDate)
        issue("工作结束日期不能早于开始日期");
      if (
        job.configured &&
        !job.rules.some((r) => r.effectiveFrom <= job.startDate)
      )
        issue("累计起始日期缺少工资规则");
      if (
        new Set(job.rules.map((r) => r.effectiveFrom)).size !==
          job.rules.length ||
        new Set(job.rules.map((r) => r.id)).size !== job.rules.length
      )
        issue("工资规则版本重复");
      let total = 0;
      for (const [d, e] of Object.entries(job.ledger)) {
        if (
          d !== e.date ||
          e.ruleId !== e.rule.id ||
          d < job.startDate ||
          (job.endDate && d > job.endDate)
        )
          issue("收入记录日期或版本不一致");
        total += e.amountCents;
      }
      if (!Number.isSafeInteger(total)) issue("累计金额超出支持范围");
    }
  });
export function parseState(input: unknown): State {
  const version = (input as { schemaVersion?: unknown } | null)?.schemaVersion;
  const state = stateSchema.parse(
    version === 1
      ? migrateV3(migrateV2(migrateV1(legacySchema.parse(input))))
      : version === 2
        ? migrateV3(migrateV2(stateV2Schema.parse(input)))
        : version === 3
          ? migrateV3(stateBase.parse(input))
          : input,
  );
  state.rules.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const job of state.otherJobs)
    job.rules.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  // The map also marks the one-time upgrade from the old default name.
  if (!state.preferences.characterNames) {
    if (state.preferences.haruName === "丝袜妹")
      state.preferences.haruName = "Haru";
    state.preferences.characterNames = {};
  }
  return state;
}
