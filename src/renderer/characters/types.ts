import type { DayProgress } from "../../shared/model";
export interface CharacterProps {
  pose?: 'idle'|'walk'|'sit'|'stretch'|'sleep'|'celebrate'|'pillow';
  direction?: 'left'|'right';
  accessory?: 'none'|'star'|'pillow';
  status: DayProgress["status"];
  reducedMotion: boolean;
  onInteract: () => void;
}
