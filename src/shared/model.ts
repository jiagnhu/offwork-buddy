export type DateKey = string;
export type CharacterKind = "pet" | "assistant" | "haru" | "mao" | "hiyori" | "miara" | "rice";
export interface RuleVersion {
  id: string;
  effectiveFrom: DateKey;
  mode: "monthly" | "daily" | "hourly";
  amount: string;
  start: number;
  end: number;
  breakStart: number | null;
  breakEnd: number | null;
  schedule: "double" | "single" | "alternating";
  restDay: number;
  bigWeekMonday: DateKey;
  official: boolean;
}
export type RuleInput = Omit<RuleVersion, "id" | "effectiveFrom">;
export interface CalendarYear {
  paidHolidays?: Record<DateKey, string>;
  source: string;
  updated: DateKey;
  days: Record<DateKey, boolean>;
}
export type CalendarData = Record<string, CalendarYear>;
export interface DayInfo {
  paidHoliday?: string;
  workday: boolean;
  source: "manual" | "official" | "schedule";
  calendarMissing: boolean;
}
export interface DayProgress {
  status: "unconfigured" | "rest" | "before" | "working" | "break" | "finished";
  countdownSeconds: number;
  countdownTarget: "lunch" | "resume" | "offwork";
  earnedCents: number;
  budgetCents: number;
  fraction: number;
  calendarMissing: boolean;
}
export interface LedgerEntry {
  algorithm?: "normal-schedule-v1";
  date: DateKey;
  ruleId: string;
  workday: boolean;
  amountCents: number;
  rule: RuleVersion;
  calendarSnapshot: DayInfo;
  workdayCount: number;
}
export interface Preferences {
  haruName?: string;
  movementMode: "bottom" | "stationary";
  cardHidden: boolean;
  cardPosition?: { x: number; y: number };
  displayId?: number;
  reminders: {
    lunch: boolean;
    offwork: boolean;
    leadMinutes: 0 | 5 | 10;
    restMinutes?: number;
  };
  accessory: "none" | "star" | "pillow";
  theme: "light" | "dark";
  character: CharacterKind;
  reducedMotion: boolean;
  scale: number;
  alwaysOnTop: boolean;
  collapsed: boolean;
  autoStart: boolean;
  position?: { x: number; y: number };
}
export interface DailyPlan {
  rewardClaimed?: boolean;
  id: string;
  text: string;
  completed: boolean;
}
export interface CompanionEvent {
  id: string;
  kind: "interaction" | "plan-complete" | "reminder";
  text: string;
  createdAt: number;
  durationMs: number;
}
export interface State {
  schemaVersion: 3;
  growth: {
    points: number;
    days: Record<
      DateKey,
      {
        interacted: boolean;
        rewardedPlanIds: string[];
        planRewardCount: number;
      }
    >;
  };
  reminderHistory: Record<string, number>;
  configured: boolean;
  startDate: DateKey;
  rules: RuleVersion[];
  calendar: CalendarData;
  overrides: Record<DateKey, boolean>;
  plans: Record<DateKey, DailyPlan[]>;
  ledger: Record<DateKey, LedgerEntry>;
  preferences: Preferences;
}
export type PreferencesV2 = Omit<Preferences, "character"> & {
  character: "pet" | "assistant";
};
export type StateV2 = Omit<State, "schemaVersion" | "preferences"> & {
  schemaVersion: 2;
  preferences: PreferencesV2;
};
export type LegacyState = Omit<
  StateV2,
  "schemaVersion" | "growth" | "reminderHistory" | "preferences"
> & {
  schemaVersion: 1;
  preferences: Omit<
    PreferencesV2,
    | "movementMode"
    | "cardHidden"
    | "cardPosition"
    | "displayId"
    | "reminders"
    | "accessory"
  >;
};
export interface Snapshot {
  behavior: {
    phase: "idle" | "walking" | "resting" | "reacting" | "dragging" | "paused";
    direction: "left" | "right";
  };
  desktop: { visible: boolean; paused: boolean };
  state: State;
  progress: DayProgress;
  settledCents: number;
  totalCents: number;
  today: DateKey;
  notice: string | null;
}
