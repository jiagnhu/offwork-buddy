import type { Snapshot, RuleInput, Preferences, DailyPlan } from "./model";
import type {EarningsDetail} from '../core/earnings-detail';
export type NavigateTarget = {page:'calendar';date:string}|{page:'earnings';date:string}|{page:'growth'};
export interface SettingsInput {
  rule: RuleInput;
  startDate: string;
}
export interface BuddyBridge {
  getSnapshot(): Promise<Snapshot>;
  saveSettings(input: SettingsInput): Promise<Snapshot>;
  setPreferences(input: Partial<Preferences>): Promise<Snapshot>;
  setDayOverride(date: string, value: boolean | null): Promise<Snapshot>;
  savePlans(date: string, plans: DailyPlan[]): Promise<Snapshot>;
  recalculate(from: string, to: string): Promise<Snapshot>;
  exportBackup(): Promise<string | null>;
  importBackup(): Promise<boolean>;
  importCalendar(): Promise<boolean>;
  getEarningsDetail(date:string):Promise<EarningsDetail>;
  openPanel(target?:NavigateTarget): Promise<void>;
  takeNavigation():Promise<NavigateTarget|null>;
  onNavigate(listener:(target:NavigateTarget)=>void):()=>void;
  hideCompanion(): Promise<void>;
  showCompanion(): Promise<void>;
  onSnapshot(listener: (s: Snapshot) => void): () => void;
}
declare global {
  interface Window {
    buddy: BuddyBridge;
  }
}
