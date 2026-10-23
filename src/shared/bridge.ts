import type { AISettingsInput, AISettingsView } from "./ai-settings";
import type { ChatState } from "./chat";
import type { Snapshot, RuleInput, Preferences, DailyPlan } from "./model";
import type { EarningsDetail } from "../core/earnings-detail";
import type { PlanAction } from "../core/plans";
import type { CompanionEvent } from "./model";
export type NavigateTarget =
  | { page: "calendar"; date: string }
  | { page: "earnings"; date: string }
  | { page: "growth" }
  | { page: "chat" };
export interface SettingsInput {
  rule: RuleInput;
  startDate: string;
}
export interface BuddyBridge {
  getAISettings(): Promise<AISettingsView>;
  saveAISettings(input: AISettingsInput): Promise<AISettingsView>;
  testAISettings(input: AISettingsInput): Promise<string>;
  getChat(): Promise<ChatState>;
  sendChat(text: string): Promise<ChatState>;
  retryChat(): Promise<ChatState>;
  stopChat(): Promise<ChatState>;
  clearChat(): Promise<ChatState>;
  onChat(listener: (state: ChatState) => void): () => void;
  dragCompanion(input: {
    phase: "start" | "move" | "end";
    x: number;
    y: number;
  }): Promise<void>;
  getWindowVisibility(): Promise<boolean>;
  onWindowVisibility(listener: (visible: boolean) => void): () => void;
  getSnapshot(): Promise<Snapshot>;
  saveSettings(input: SettingsInput): Promise<Snapshot>;
  setPreferences(input: Partial<Preferences>): Promise<Snapshot>;
  setLeave(
    date: string,
    intervals: import("./model").LeaveInterval[],
  ): Promise<Snapshot>;
  setDayOverride(date: string, value: boolean | null): Promise<Snapshot>;
  updatePlan(date: string, action: PlanAction): Promise<Snapshot>;
  interact(): Promise<Snapshot>;
  onCompanionEvent(listener: (event: CompanionEvent) => void): () => void;
  recalculate(from: string, to: string): Promise<Snapshot>;
  exportBackup(): Promise<string | null>;
  importBackup(): Promise<boolean>;
  importCalendar(): Promise<boolean>;
  getEarningsDetail(date: string): Promise<EarningsDetail>;
  openPanel(target?: NavigateTarget): Promise<void>;
  takeNavigation(): Promise<NavigateTarget | null>;
  onNavigate(listener: (target: NavigateTarget) => void): () => void;
  hideCompanion(): Promise<void>;
  showCompanion(): Promise<void>;
  setCardHidden(hidden: boolean): Promise<Snapshot>;
  recallCompanion(): Promise<void>;
  onSnapshot(listener: (s: Snapshot) => void): () => void;
}
declare global {
  interface Window {
    buddy: BuddyBridge;
  }
}
