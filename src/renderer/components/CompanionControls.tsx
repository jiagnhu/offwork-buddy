import { useRef, useState } from "react";
import { characterOrder, normalizeCharacter } from "../../shared/characters";
import {
  MessageCircle,
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
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const run = (promise: Promise<unknown>) =>
    void promise.catch((e) => onError(e.message));
  return (
    <div className="companion-toolbar" data-dragging={isDragging}>
      <span
        className="drag-handle"
        title="拖动伙伴"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          lastPointer.current = { x: e.screenX, y: e.screenY };
          setDragging(true);
          run(
            window.buddy.dragCompanion({
              phase: "start",
              x: e.screenX,
              y: e.screenY,
            }),
          );
        }}
        onPointerMove={(e) => {
          lastPointer.current = { x: e.screenX, y: e.screenY };
          if (dragging.current)
            run(
              window.buddy.dragCompanion({
                phase: "move",
                x: e.screenX,
                y: e.screenY,
              }),
            );
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          setDragging(false);
          run(
            window.buddy.dragCompanion({
              phase: "end",
              x: e.screenX,
              y: e.screenY,
            }),
          );
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onLostPointerCapture={() => {
          if (dragging.current)
            run(
              window.buddy.dragCompanion({
                phase: "end",
                ...lastPointer.current,
              }),
            );
          dragging.current = false;
          setDragging(false);
        }}
      >
        <GripHorizontal size={17} />
      </span>
      <button
        aria-label="和伙伴聊天"
        title="和伙伴聊天"
        onClick={() => run(window.buddy.openPanel({ page: "chat" }))}
      >
        <MessageCircle size={14} />
      </button>
      <button
        aria-label="切换伙伴"
        onClick={() =>
          run(
            window.buddy.setPreferences({
              character:
                characterOrder[
                  (characterOrder.indexOf(normalizeCharacter(p.character)) +
                    1) %
                    characterOrder.length
                ],
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
        disabled
        title="当前角色以原地动画陪伴"
        aria-label="当前角色以原地动画陪伴"
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
