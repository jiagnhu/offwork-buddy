import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import type { Snapshot } from "../../shared/model";
import { characterName } from "../../shared/characters";
import Character from "../characters/Character";

type Target = { element: HTMLDivElement; overview: boolean; paused: boolean };
const Placement = createContext<Dispatch<SetStateAction<Target | null>> | null>(
  null,
);

// The portal container never changes. Moving this DOM host preserves the canvas,
// React component, WebGL context and loaded model across page layouts.
export function SharedCharacterProvider({
  snapshot,
  children,
}: {
  snapshot: Snapshot;
  children: ReactNode;
}) {
  const [host] = useState(() => {
    const element = document.createElement("div");
    element.style.cssText = "width:100%;height:100%";
    return element;
  });
  const [target, setTarget] = useState<Target | null>(null);
  const parking = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    (target?.element ?? parking.current)?.appendChild(host);
  }, [host, target]);
  const p = snapshot.state.preferences;
  return (
    <Placement.Provider value={setTarget}>
      {children}
      <div ref={parking} hidden data-character-parking />
      {createPortal(
        <Character
          kind={p.character}
          displayName={characterName(p.character, p)}
          status={snapshot.progress.status}
          reducedMotion={p.reducedMotion}
          active={!!target && !target.paused}
          retainWhenInactive
          onInteract={() => {
            if (target?.overview) void window.buddy.showCompanion();
          }}
        />,
        host,
      )}
    </Placement.Provider>
  );
}

export function SharedCharacterSlot({
  active = true,
  overview = false,
  paused = false,
}: {
  active?: boolean;
  overview?: boolean;
  paused?: boolean;
}) {
  const setTarget = useContext(Placement);
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = slot.current;
    if (!active || !element || !setTarget) return;
    setTarget({ element, overview, paused });
    return () =>
      setTarget((previous) =>
        previous?.element === element ? null : previous,
      );
  }, [active, overview, paused, setTarget]);
  return <div ref={slot} style={{ width: "100%", height: "100%" }} />;
}
