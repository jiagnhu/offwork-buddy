import Pet from "./Pet";
import Assistant from "./Assistant";
import type { CharacterProps } from "./types";
export default function Character(
  props: CharacterProps & { kind: "pet" | "assistant" },
) {
  return props.kind === "pet" ? <Pet {...props} /> : <Assistant {...props} />;
}
