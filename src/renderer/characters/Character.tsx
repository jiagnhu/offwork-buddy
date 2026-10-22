import Pet from "./Pet";
import Assistant from "./Assistant";
import type { CharacterProps } from "./types";
import type { CharacterKind, CompanionEvent } from '../../shared/model';
import HaruCharacter from './live2d/HaruCharacter';
import { actionForCompanionEvent } from './live2d/actions';
export default function Character(
  props: CharacterProps & { kind: CharacterKind; active?:boolean; event?:CompanionEvent|null },
) {
  if(props.kind==='haru')return <HaruCharacter active={props.active} reducedMotion={props.reducedMotion} onInteract={props.onInteract} actionRequest={props.event?{id:props.event.id,action:actionForCompanionEvent(props.event)}:undefined}/>;
  return props.kind === "pet" ? <Pet {...props} /> : <Assistant {...props} />;
}
