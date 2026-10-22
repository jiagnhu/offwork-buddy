import { ensureCore } from "./core";
import { HaruModel } from "./model";
import { frameLoop } from "./lifecycle";
import { CubismMatrix44 } from "../../../../vendor/cubism-framework/lib/math/cubismmatrix44";
import { CubismShaderManager_WebGL } from "../../../../vendor/cubism-framework/lib/rendering/cubismshader_webgl";
import type { HaruRuntime } from "./types";
export async function createHaruRuntime(
  canvas: HTMLCanvasElement,
  options: {
    signal: AbortSignal;
    reducedMotion: boolean;
    onError: (e: Error) => void;
  },
): Promise<HaruRuntime> {
  options.signal.throwIfAborted();
  ensureCore();
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
  });
  if (!gl) throw new Error("无法创建 WebGL 画布");
  const model = new HaruModel(),
    textures: WebGLTexture[] = [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener("abort", abort, { once: true });
  let disposed = false,
    reduced = options.reducedMotion,
    loop: ReturnType<typeof frameLoop> | undefined,
    contextError: Error | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    loop?.dispose();
    canvas.removeEventListener("webglcontextlost", lost);
    options.signal.removeEventListener("abort", abort);
    model.release();
    textures.forEach((t) => gl.deleteTexture(t));
    CubismShaderManager_WebGL.getInstance().removeContext(gl);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    contextError = new Error("图形上下文已丢失，请重试");
    dispose();
    options.onError(contextError);
  };
  canvas.addEventListener("webglcontextlost", lost);
  try {
    const textureFiles = await model.load(controller.signal);
    controller.signal.throwIfAborted();
    model.createRenderer(canvas.width, canvas.height);
    const renderer = model.getRenderer();
    renderer.startUp(gl);
    const shader = CubismShaderManager_WebGL.getInstance().getShader(gl);
    shader.setShaderPath("buddy-live2d://assets/haru/shaders/");
    await shader.prepare(controller.signal);
    for (let i = 0; i < textureFiles.length; i++) {
      const r = await fetch("buddy-live2d://assets/haru/" + textureFiles[i], {
        signal: controller.signal,
      });
      if (!r.ok || !r.headers.get("content-type")?.startsWith("image/png"))
        throw new Error(`纹理加载失败：${textureFiles[i]}`);
      const bitmap = await createImageBitmap(await r.blob(), {
        premultiplyAlpha: "premultiply",
        imageOrientation: "none",
      });
      try {
        controller.signal.throwIfAborted();
        const texture = gl.createTexture();
        if (!texture) throw new Error("纹理创建失败");
        textures.push(texture);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bitmap,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        renderer.bindTexture(i, texture);
      } finally {
        bitmap.close();
      }
    }
    renderer.setIsPremultipliedAlpha(true);
    const projection = new CubismMatrix44();
    const draw = (dt: number) => {
      if (disposed) return;
      try {
        model.update(dt, reduced);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        projection.loadIdentity();
        const aspect = canvas.width / canvas.height;
        // Fit the complete model with a gesture margin, preserving aspect ratio.
        projection.scale(
          1.18 / Math.max(aspect, 1),
          1.18 * Math.min(aspect, 1),
        );
        projection.multiplyByMatrix(model.getModelMatrix());
        renderer.setMvpMatrix(projection);
        renderer.setRenderState(null!, [0, 0, canvas.width, canvas.height]);
        renderer.drawModel();
      } catch (e) {
        dispose();
        options.onError(e instanceof Error ? e : new Error(String(e)));
      }
    };
    loop = frameLoop(draw);
    const runtime: HaruRuntime = {
      play(action) {
        if (!disposed) {
          model.play(action, reduced);
          loop!.invalidate();
        }
      },
      setPointer(x, y) {
        if (!disposed && !reduced)
          model.setDragging(
            Math.max(-1, Math.min(1, x)),
            Math.max(-1, Math.min(1, y)),
          );
      },
      setReducedMotion(value) {
        if (!disposed) {
          reduced = value;
          loop!.setReduced(value);
        }
      },
      resize(w, h, dpr) {
        if (disposed) return;
        canvas.width = Math.max(1, Math.round(w * Math.min(dpr, 2)));
        canvas.height = Math.max(1, Math.round(h * Math.min(dpr, 2)));
        model.setRenderTargetSize(canvas.width, canvas.height);
        loop!.invalidate();
      },
      dispose,
    };
    const rect = canvas.getBoundingClientRect();
    runtime.resize(rect.width, rect.height, devicePixelRatio);
    loop.setReduced(reduced);
    return runtime;
  } catch (e) {
    dispose();
    throw contextError ?? e;
  }
}
