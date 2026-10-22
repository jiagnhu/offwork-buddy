import type { Snapshot, RuleInput, Preferences, DailyPlan } from "./model";
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
  openPanel(): Promise<void>;
  hideCompanion(): Promise<void>;
  showCompanion(): Promise<void>;
  onSnapshot(listener: (s: Snapshot) => void): () => void;
}
declare global {
  interface Window {
    buddy: BuddyBridge;
  }
}
