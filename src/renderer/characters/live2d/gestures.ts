import type { Live2dKind } from "../../../shared/characters";

export type GestureCue = "attention" | "thinking" | "happy" | "rest";
export const gestureLabels: Record<Live2dKind, Record<GestureCue, string>> = {
  haru: {
    attention: "点头回应",
    thinking: "侧耳倾听",
    happy: "闭眼微笑",
    rest: "放松一下",
  },
  hiyori: {
    attention: "左右看看",
    thinking: "轻轻摇头",
    happy: "开心回应",
    rest: "闭目休息",
  },
  mao: {
    attention: "俏皮歪头",
    thinking: "好奇打量",
    happy: "魔法庆祝",
    rest: "放松肩膀",
  },
  miara: {
    attention: "轻轻转身",
    thinking: "侧头思考",
    happy: "精灵互动",
    rest: "轻柔舒展",
  },
  rice: {
    attention: "侧耳倾听",
    thinking: "低头思索",
    happy: "翻书庆祝",
    rest: "阅读小憩",
  },
};

// Values are fractions of each real parameter's range, applied without saving
// them into the base animation. Endpoints are zero to blend back into idle.
export function sampleGesture(
  kind: Live2dKind,
  cue: GestureCue,
  progress: number,
): Record<string, number> {
  const t = Math.max(0, Math.min(1, progress));
  const e = Math.sin(Math.PI * t) ** 2,
    wave = Math.sin(2 * Math.PI * t) * e;
  const v: Record<string, number> = {};
  const put = (id: string, n: number) => {
    v[id] = n;
  };
  if (cue === "attention") {
    if (kind === "haru") put("ParamAngleY", -0.11 * wave);
    if (kind === "hiyori") {
      put("ParamAngleX", 0.13 * wave);
      put("ParamEyeBallX", 0.18 * wave);
    }
    if (kind === "mao") {
      put("ParamAngleZ", 0.15 * wave);
      put("ParamLeftShoulderUp", 0.12 * e);
    }
    if (kind === "miara") {
      put("ParamBodyAngleX", 0.09 * wave);
      put("ParamAngleZ", 0.08 * e);
    }
    if (kind === "rice") {
      put("ParamAngleZ", 0.12 * e);
      put("ParamEyeBallX", -0.12 * e);
    }
  } else if (cue === "thinking") {
    put("ParamAngleZ", (kind === "mao" ? -0.14 : 0.1) * e);
    put("ParamEyeBallX", -0.12 * e);
    if (kind === "hiyori") put("ParamAngleX", 0.12 * wave);
    if (kind === "rice") put("ParamEyeBallY", -0.15 * e);
    else put("ParamAngleY", 0.07 * e);
  } else if (cue === "happy") {
    put("ParamBodyAngleZ", 0.045 * wave);
    put("ParamAngleZ", -0.07 * e);
    if (kind === "rice") put("ParamBookPage", 0.45 * e);
    else {
      put("ParamEyeLOpen", -0.75 * e);
      put("ParamEyeROpen", -0.75 * e);
      if (kind !== "miara") {
        put("ParamEyeLSmile", 0.65 * e);
        put("ParamEyeRSmile", 0.65 * e);
      }
      put(kind === "mao" ? "ParamMouthUp" : "ParamMouthForm", 0.45 * e);
    }
  } else {
    put("ParamEyeLOpen", -0.65 * e);
    put("ParamEyeROpen", -0.65 * e);
    put("ParamBodyAngleZ", 0.035 * wave);
    put("ParamAngleZ", 0.06 * e);
    if (kind === "mao") {
      put("ParamLeftShoulderUp", -0.08 * e);
      put("ParamRightShoulderUp", -0.08 * e);
    }
  }
  return v;
}

export function boundedOffset(
  value: number,
  fraction: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, value + fraction * (max - min)));
}

/** Runs only on visible animation frames; no wall-clock timers survive hiding. */
type NativeClip = { kind: "idle" | "tap"; index: number };
export class MotionDirector {
  private active?: GestureCue;
  private elapsed = 0;
  private duration = 4;
  private pending?: GestureCue;
  private reduced = false;
  private remaining: number;
  private lastIdle = -1;
  private interactionCount = 0;
  private nativeActive?: NativeClip;
  private nativeRemaining = 0;
  private pendingNative?: { clip: NativeClip; seconds: number };
  constructor(private random = Math.random) {
    this.remaining = this.interval();
  }
  private interval() {
    return 20 + this.random() * 25;
  }
  request(cue: GestureCue) {
    if (this.reduced) return;
    // Keep at most one pending reaction; important events outrank repeated taps.
    if (this.active === cue) return;
    if (
      cue === "attention" &&
      (this.pending || this.active || this.nativeActive)
    )
      return;
    this.pending =
      cue === "attention" && this.interactionCount++ % 2 ? "thinking" : cue;
  }
  requestNative(clip: NativeClip, seconds: number) {
    if (this.reduced) return;
    if (
      this.nativeActive?.kind === clip.kind &&
      this.nativeActive.index === clip.index
    )
      return;
    this.pendingNative = { clip, seconds: Math.max(4, seconds) };
  }
  hold(seconds: number) {
    this.duration = Math.max(4, seconds);
  }
  setReduced(value: boolean) {
    if (value === this.reduced) return;
    this.reduced = value;
    this.active = undefined;
    this.pending = undefined;
    this.nativeActive = undefined;
    this.pendingNative = undefined;
    this.nativeRemaining = 0;
    this.elapsed = 0;
    this.remaining = this.interval();
  }
  advance(delta: number): {
    cue?: GestureCue;
    progress: number;
    started?: GestureCue;
    autonomous?: boolean;
    native?: NativeClip;
  } {
    if (this.reduced) return { progress: 0 };
    if (this.nativeActive) {
      this.nativeRemaining -= delta;
      if (this.nativeRemaining > 0) return { progress: 0 };
      this.nativeActive = undefined;
      this.remaining = this.interval();
    }
    if (this.active) {
      this.elapsed += delta;
      if (this.elapsed < this.duration)
        return { cue: this.active, progress: Math.min(1, this.elapsed / 4) };
      this.active = undefined;
      this.remaining = this.interval();
    } else this.remaining -= delta;
    let cue = this.pending,
      autonomous = false;
    this.pending = undefined;
    if (!cue && this.pendingNative) {
      const next = this.pendingNative;
      this.pendingNative = undefined;
      this.nativeActive = next.clip;
      this.nativeRemaining = next.seconds;
      return { progress: 0, native: next.clip };
    }
    if (!cue && this.remaining <= 0) {
      const cues: GestureCue[] = ["attention", "thinking", "rest"];
      this.lastIdle = (this.lastIdle + 1 + Math.floor(this.random() * 2)) % 3;
      cue = cues[this.lastIdle];
      autonomous = true;
    }
    if (!cue) return { progress: 0 };
    this.active = cue;
    this.elapsed = 0;
    this.duration = 4;
    return { cue, progress: 0, started: cue, autonomous };
  }
}
