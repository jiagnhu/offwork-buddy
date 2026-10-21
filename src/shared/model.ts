export type DateKey = string;
export interface RuleVersion { id:string; effectiveFrom:DateKey; mode:'monthly'|'daily'|'hourly'; amount:string; start:number; end:number; breakStart:number|null; breakEnd:number|null; schedule:'double'|'single'|'alternating'; restDay:number; bigWeekMonday:DateKey; official:boolean }
export type RuleInput = Omit<RuleVersion,'id'|'effectiveFrom'>;
export interface CalendarYear {source:string;updated:DateKey;days:Record<DateKey,boolean>}
export type CalendarData = Record<string,CalendarYear>;
export interface DayInfo {workday:boolean;source:'manual'|'official'|'schedule';calendarMissing:boolean}
export interface DayProgress {status:'unconfigured'|'rest'|'before'|'working'|'break'|'finished';countdownSeconds:number;earnedCents:number;budgetCents:number;fraction:number;calendarMissing:boolean}
export interface LedgerEntry {date:DateKey;ruleId:string;workday:boolean;amountCents:number;rule:RuleVersion;calendarSnapshot:DayInfo;workdayCount:number}
export interface Preferences {theme:'light'|'dark';character:'pet'|'assistant';reducedMotion:boolean;scale:number;alwaysOnTop:boolean;collapsed:boolean;autoStart:boolean;position?:{x:number;y:number}}
export interface State {schemaVersion:1;configured:boolean;startDate:DateKey;rules:RuleVersion[];calendar:CalendarData;overrides:Record<DateKey,boolean>;ledger:Record<DateKey,LedgerEntry>;preferences:Preferences}
export interface Snapshot {state:State;progress:DayProgress;settledCents:number;totalCents:number;today:DateKey;notice:string|null}
