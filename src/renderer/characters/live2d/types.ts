export type NativeAction =
  { kind: "idle" | "tap"; index: number } | { kind: "expression"; id: string };
export type HaruAction =
  NativeAction | { kind: "random"; group?: "idle" | "tap" };
export interface HaruRuntime {
  play(action: HaruAction): void;
  setPointer(x: number, y: number): void;
  setReducedMotion(value: boolean): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}
