import { useState } from "react";
import type { Snapshot } from "../../shared/model";
import Character from "../characters/Character";
import CompanionControls from "../components/CompanionControls";
import { useCompanionEvent, useDesktopScale } from "../hooks/useCompanionEvent";
import { characterCapabilities } from "../../shared/character-capabilities";
export default function Companion({ snapshot }: { snapshot: Snapshot }) {
  const p = snapshot.state.preferences,
    { event, dismiss } = useCompanionEvent(),
    [error, setError] = useState("");
  const pose = event
    ? event.kind === "plan-complete" && snapshot.state.growth.points >= 60
      ? "celebrate"
      : "stretch"
    : snapshot.behavior.phase === "walking"
      ? "walk"
      : snapshot.behavior.phase === "resting"
        ? p.accessory === "pillow"
          ? "pillow"
          : "sit"
        : snapshot.progress.status === "finished"
          ? "sleep"
          : snapshot.progress.status === "break"
            ? "sit"
            : "idle";
  const size = characterCapabilities(p.character);
  const scale = useDesktopScale(p.scale, size.baseHeight);
  return (
    <div
      className={`companion-root ${p.character === "haru" ? "companion-haru" : ""}`}
      style={{
        width: size.baseWidth,
        height: size.baseHeight,
        transform: `scale(${scale})`,
      }}
    >
      <CompanionControls snapshot={snapshot} onError={setError} />
      <div className="companion-stage">
        {event && (
          <button
            className="speech-bubble"
            onClick={dismiss}
            aria-label="关闭伙伴提示"
          >
            {event.text}
          </button>
        )}
        <Character
          displayName={p.haruName}
          event={event}
          active={snapshot.desktop.visible}
          pose={pose}
          direction={snapshot.behavior.direction}
          accessory={p.accessory}
          kind={p.character}
          status={snapshot.progress.status}
          reducedMotion={p.reducedMotion}
          onInteract={() =>
            void window.buddy.interact().catch((e) => setError(e.message))
          }
        />
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
