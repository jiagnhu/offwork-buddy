import { CubismUserModel } from "../../../../vendor/cubism-framework/lib/model/cubismusermodel";
import { CubismModelSettingJson } from "../../../../vendor/cubism-framework/lib/cubismmodelsettingjson";
import { CubismFramework } from "../../../../vendor/cubism-framework/lib/live2dcubismframework";
import { CubismEyeBlink } from "../../../../vendor/cubism-framework/lib/effect/cubismeyeblink";
import {
  CubismBreath,
  BreathParameterData,
} from "../../../../vendor/cubism-framework/lib/effect/cubismbreath";
import { CubismMotion } from "../../../../vendor/cubism-framework/lib/motion/cubismmotion";
import { ACubismMotion } from "../../../../vendor/cubism-framework/lib/motion/acubismmotion";
import type { HaruAction } from "./types";
import type { Live2dKind } from "../../../shared/characters";
import {
  MotionDirector,
  sampleGesture,
  boundedOffset,
  type GestureCue,
} from "./gestures";

export async function fetchBytes(
  file: string,
  signal: AbortSignal,
  base: string,
) {
  const r = await fetch(base + file, { signal });
  if (!r.ok) throw new Error(`角色资源加载失败：${file} (${r.status})`);
  return r.arrayBuffer();
}
export class HaruModel extends CubismUserModel {
  private kind: Live2dKind = "haru";
  private director = new MotionDirector();
  private parameters = new Map<string, number>();
  private staticCue?: GestureCue;
  private idleIndex = 0;
  private celebrationIndex = 0;
  motions: { idle: CubismMotion[]; tap: CubismMotion[] } = {
    idle: [],
    tap: [],
  };
  expressions = new Map<string, ACubismMotion>();
  expressionData = new Map<
    string,
    { Id: string; Value: number; Blend: string }[]
  >();
  staticExpression = "";
  async load(
    signal: AbortSignal,
    kind: Live2dKind = "haru",
    filename = "Haru.model3.json",
  ) {
    const bytes = (file: string, signal: AbortSignal) =>
      fetchBytes(file, signal, `buddy-live2d://assets/${kind}/`);
    const raw = await bytes(filename, signal);
    const settings = new CubismModelSettingJson(raw, raw.byteLength);
    try {
      this.loadModel(await bytes(settings.getModelFileName(), signal), true);
      signal.throwIfAborted();
      if (!this._model) throw new Error("角色模型无效");
      this.kind = kind;
      for (let i = 0; i < this._model.getParameterCount(); i++)
        this.parameters.set(this._model.getParameterId(i).getString(), i);
      for (const [filename, fn] of [
        [settings.getPhysicsFileName(), this.loadPhysics],
        [settings.getPoseFileName(), this.loadPose],
      ] as const) {
        if (!filename) continue;
        const b = await bytes(filename, signal);
        fn.call(this, b, b.byteLength);
      }
      this._eyeBlink = CubismEyeBlink.create(settings);
      this._breath = CubismBreath.create();
      this._breath.setParameters([
        new BreathParameterData(
          CubismFramework.getIdManager().getId("ParamBreath"),
          0.5,
          0.5,
          3.2,
          0.5,
        ),
      ]);
      for (const group of ["Idle", "TapBody"]) {
        const target = group === "Idle" ? this.motions.idle : this.motions.tap;
        for (let i = 0; i < settings.getMotionCount(group); i++) {
          const b = await bytes(settings.getMotionFileName(group, i), signal);
          const motion = this.loadMotion(
            b,
            b.byteLength,
            `${group}_${i}`,
            undefined,
            undefined,
            settings,
            group,
            i,
          );
          if (!motion) throw new Error("动作加载失败");
          if (group === "TapBody") motion.setLoop(false);
          motion.setFadeInTime(0.6);
          motion.setFadeOutTime(0.6);
          motion.setEffectIds(
            settings.getEyeBlinkParameterCount()
              ? Array.from(
                  { length: settings.getEyeBlinkParameterCount() },
                  (_, i) => settings.getEyeBlinkParameterId(i),
                )
              : [],
            [],
          );
          target.push(motion);
        }
      }
      for (let i = 0; i < settings.getExpressionCount(); i++) {
        const b = await bytes(settings.getExpressionFileName(i), signal),
          name = settings.getExpressionName(i);
        this.expressions.set(name, this.loadExpression(b, b.byteLength, name));
        this.expressionData.set(
          name,
          JSON.parse(new TextDecoder().decode(b)).Parameters,
        );
      }
      this._model.saveParameters();
      return Array.from({ length: settings.getTextureCount() }, (_, i) =>
        settings.getTextureFileName(i),
      );
    } finally {
      settings.release();
    }
  }
  play(action: HaruAction, reduced: boolean) {
    this.director.setReduced(reduced);
    if (action.kind === "cue") {
      this.staticCue = action.cue;
      this.staticExpression = "";
      this.director.request(action.cue);
    } else if (action.kind === "expression") {
      const expression = this.expressions.get(action.id);
      if (!expression) return;
      this.staticExpression = action.id;
      this.staticCue = undefined;
      if (!reduced) this._expressionManager.startMotion(expression, false);
    } else {
      if (
        !Number.isInteger(action.index) ||
        !this.motions[action.kind][action.index]
      )
        throw new Error("未知动作");
      if (!reduced) {
        const motion = this.motions[action.kind][action.index];
        this.director.requestNative(
          action,
          Math.max(motion.getDuration(), motion.getLoopDuration()) + 0.6,
        );
      }
    }
  }
  update(delta: number, reduced: boolean) {
    this.director.setReduced(reduced);
    this._model.loadParameters();
    if (!reduced) {
      const frame = this.director.advance(delta);
      if (frame.native) {
        if (frame.native.kind === "idle") this.idleIndex = frame.native.index;
        this._motionManager.startMotionPriority(
          this.motions[frame.native.kind][frame.native.index],
          false,
          3,
        );
      }
      if (frame.started && frame.autonomous && this.motions.idle.length > 1) {
        this.idleIndex =
          (this.idleIndex +
            1 +
            Math.floor(Math.random() * (this.motions.idle.length - 1))) %
          this.motions.idle.length;
        this._motionManager.startMotionPriority(
          this.motions.idle[this.idleIndex],
          false,
          1,
        );
      }
      if (
        frame.started === "happy" &&
        ["mao", "miara", "rice"].includes(this.kind)
      ) {
        const pool =
          this.kind === "mao" ? this.motions.tap.slice(3) : this.motions.tap;
        const motion = pool[this.celebrationIndex++ % pool.length];
        if (motion) {
          this._motionManager.startMotionPriority(motion, false, 3);
          this.director.hold(motion.getDuration() + 0.6);
        }
      }
      if (this._motionManager.isFinished() && this.motions.idle[this.idleIndex])
        this._motionManager.startMotionPriority(
          this.motions.idle[this.idleIndex],
          false,
          1,
        );
      const animated = this._motionManager.updateMotion(this._model, delta);
      this._model.saveParameters();
      if (!animated) this._eyeBlink.updateParameters(this._model, delta);
      this._expressionManager.updateMotion(this._model, delta);
      this._dragManager.update(delta);
      const x = this._dragManager.getX(),
        y = this._dragManager.getY(),
        ids = CubismFramework.getIdManager();
      for (const [name, value] of [
        ["ParamAngleX", x * 15],
        ["ParamAngleY", y * 12],
        ["ParamEyeBallX", x],
        ["ParamEyeBallY", y],
      ] as const)
        if (this.parameters.has(name))
          this._model.addParameterValueById(ids.getId(name), value);
      if (frame.cue) this.applyGesture(frame.cue, frame.progress);
      this._breath.updateParameters(this._model, delta);
      this._physics?.evaluate(this._model, delta);
      this._pose?.updateParameters(this._model, delta);
    } else {
      for (const p of this.expressionData.get(this.staticExpression) || []) {
        const id = CubismFramework.getIdManager().getId(p.Id);
        if (p.Blend === "Overwrite")
          this._model.setParameterValueById(id, p.Value);
        else if (p.Blend === "Multiply")
          this._model.multiplyParameterValueById(id, p.Value);
        else this._model.addParameterValueById(id, p.Value);
      }
      if (this.staticCue) this.applyGesture(this.staticCue, 0.4);
    }
    this._model.update();
  }
  private applyGesture(cue: GestureCue, progress: number) {
    for (const [id, offset] of Object.entries(
      sampleGesture(this.kind, cue, progress),
    )) {
      const i = this.parameters.get(id);
      if (i === undefined) continue;
      this._model.setParameterValueByIndex(
        i,
        boundedOffset(
          this._model.getParameterValueByIndex(i),
          offset,
          this._model.getParameterMinimumValue(i),
          this._model.getParameterMaximumValue(i),
        ),
      );
    }
  }
  override release() {
    super.release();
    for (const m of [
      ...this.motions.idle,
      ...this.motions.tap,
      ...this.expressions.values(),
    ])
      ACubismMotion.delete(m);
    this.motions = { idle: [], tap: [] };
    this.expressions.clear();
    this.expressionData.clear();
  }
}
