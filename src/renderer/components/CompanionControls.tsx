import {
  GripHorizontal,
  Shuffle,
  Pin,
  PinOff,
  Minus,
  Plus,
  Settings,
  X,
  Pause,
  Play,
  Home,
} from "lucide-react";
import type { Snapshot } from "../../shared/model";
export default function CompanionControls({
  snapshot,
  onError,
}: {
  snapshot: Snapshot;
  onError: (error: string) => void;
}) {
  const p = snapshot.state.preferences;
  const run = (promise: Promise<unknown>) =>
    void promise.catch((e) => onError(e.message));
  return (
    <div className="companion-toolbar">
      <span className="drag-handle" title="拖动伙伴">
        <GripHorizontal size={17} />
      </span>
      <button
        aria-label="切换伙伴"
        onClick={() =>
          run(
            window.buddy.setPreferences({
              character: p.character === "pet" ? "assistant" : "pet",
            }),
          )
        }
      >
        <Shuffle size={14} />
      </button>
      <button
        aria-label="切换置顶"
        onClick={() =>
          run(window.buddy.setPreferences({ alwaysOnTop: !p.alwaysOnTop }))
        }
      >
        {p.alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
      </button>
      <button
        aria-label={p.movementMode === "bottom" ? "暂停散步" : "继续散步"}
        onClick={() =>
          run(
            window.buddy.setPreferences({
              movementMode:
                p.movementMode === "bottom" ? "stationary" : "bottom",
            }),
          )
        }
      >
        {p.movementMode === "bottom" ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        aria-label="叫回伙伴"
        onClick={() => run(window.buddy.recallCompanion())}
      >
        <Home size={14} />
      </button>
      <button
        aria-label={p.collapsed || p.cardHidden ? "展开信息卡" : "收起信息卡"}
        onClick={() =>
          run(window.buddy.setCardHidden(!(p.cardHidden || p.collapsed)))
        }
      >
        {p.collapsed || p.cardHidden ? <Plus size={14} /> : <Minus size={14} />}
      </button>
      <button
        aria-label="打开设置"
        onClick={() => run(window.buddy.openPanel())}
      >
        <Settings size={14} />
      </button>
      <button
        aria-label="隐藏伙伴"
        onClick={() => run(window.buddy.hideCompanion())}
      >
        <X size={14} />
      </button>
    </div>
  );
}
