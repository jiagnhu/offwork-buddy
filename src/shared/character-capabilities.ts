import type { CharacterKind, Preferences } from "./model";
const capabilities = {
  pet: {
    baseWidth: 360,
    baseHeight: 310,
    canRoam: true,
    supportsAccessories: true,
  },
  assistant: {
    baseWidth: 360,
    baseHeight: 310,
    canRoam: true,
    supportsAccessories: true,
  },
  haru: {
    baseWidth: 360,
    baseHeight: 500,
    canRoam: false,
    supportsAccessories: false,
  },
} as const;
export function characterCapabilities(kind: CharacterKind) {
  return capabilities[kind as keyof typeof capabilities] ?? capabilities.haru;
}
export function effectiveMovementMode(prefs: Preferences) {
  return characterCapabilities(prefs.character).canRoam
    ? prefs.movementMode
    : "stationary";
}
