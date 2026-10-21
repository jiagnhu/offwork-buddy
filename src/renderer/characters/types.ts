import type { DayProgress } from "../../shared/model";
export interface CharacterProps {
  status: DayProgress["status"];
  reducedMotion: boolean;
  onInteract: () => void;
}
