import { normalizeCharacter, characterName } from "../../shared/characters";

import type { CharacterProps } from "./types";
import type { CharacterKind, CompanionEvent } from "../../shared/model";
import HaruCharacter from "./live2d/HaruCharacter";
import { actionForCompanionEvent } from "./live2d/actions";
export default function Character(
  props: CharacterProps & {
    displayName?: string;
    displayScale?: number;
    kind: CharacterKind;
    active?: boolean;
    retainWhenInactive?: boolean;
    event?: CompanionEvent | null;
  },
) {
  const kind = normalizeCharacter(props.kind);
  return (
    <HaruCharacter
      key={kind}
      kind={kind}
      displayScale={props.displayScale}
      displayName={props.displayName ?? characterName(kind)}
      active={props.active}
      retainWhenInactive={props.retainWhenInactive}
      reducedMotion={props.reducedMotion}
      onInteract={props.onInteract}
      actionRequest={
        props.event && props.event.kind !== "interaction"
          ? {
              id: props.event.id,
              action: actionForCompanionEvent(
                props.event,
                props.reducedMotion,
                kind,
              ),
            }
          : undefined
      }
    />
  );
}
