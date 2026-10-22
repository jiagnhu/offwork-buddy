import inventory from "./character-inventory.json";
import type { CharacterKind, Preferences } from "./model";
export const live2dModels = inventory;
export type Live2dKind = keyof typeof inventory;
export const characterOrder = Object.keys(inventory) as Live2dKind[];
export function normalizeCharacter(kind: CharacterKind): Live2dKind {
  return kind === "pet" || kind === "assistant" ? "haru" : kind;
}
export function characterName(
  kind: CharacterKind,
  preferences: Pick<Preferences, "haruName" | "characterNames"> = {},
) {
  const id = normalizeCharacter(kind);
  return id === "haru"
    ? (preferences.haruName ?? "Haru")
    : (preferences.characterNames?.[id] ?? inventory[id].name);
}
