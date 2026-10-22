import { useEffect, useRef, useState } from "react";
import { useWindowVisible } from "../../hooks/useWindowVisible";
import { mountResource } from "./lifecycle";
import type { HaruAction, HaruRuntime } from "./types";
export default function HaruCharacter({
  displayName = "丝袜妹",
  displayScale = 1,
  active = true,
  reducedMotion,
  actionRequest,
  onInteract,
}: {
  displayName?: string;
  displayScale?: number;
  active?: boolean;
  reducedMotion: boolean;
  actionRequest?: { id: string; action: HaruAction };
  onInteract: () => void;
}) {
  const visible = useWindowVisible(),
    canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<HaruRuntime | null>(null);
  const [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [retry, setRetry] = useState(0);
  const motion = useRef(reducedMotion);
  motion.current = reducedMotion;
  const enabled = active && visible;
  useEffect(() => {
    if (!enabled || !canvas.current) return;
    setError("");
    setLoaded(false);
    const element = canvas.current;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    let resolution: MediaQueryList | undefined;
    const resize = () => {
      const r = element.getBoundingClientRect();
      runtime.current?.resize(r.width, r.height, devicePixelRatio);
    };
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };
    const watchResolution = () => {
      resolution?.removeEventListener("change", watchResolution);
      resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      resolution.addEventListener("change", watchResolution);
      resize();
    };
    const stop = mountResource(
      async (signal) => {
        if (typeof Live2DCubismCore === "undefined")
          throw new Error("角色引擎未能加载，请重启软件或切回原角色");
        const { createHaruRuntime } = await import("./runtime");
        signal.throwIfAborted();
        return createHaruRuntime(element, {
          signal,
          reducedMotion: motion.current,
          onError: (e) => {
            setError(e.message);
            setLoaded(false);
          },
        });
      },
      (value) => {
        runtime.current = value;
        value.setReducedMotion(motion.current);
        setLoaded(true);
        observer = new ResizeObserver(resize);
        observer.observe(element);
        window.addEventListener("resize", scheduleResize);
        watchResolution();
      },
      (e) => setError(e.message),
    );
    return () => {
      setLoaded(false);
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      resolution?.removeEventListener("change", watchResolution);
      window.removeEventListener("resize", scheduleResize);
      runtime.current = null;
      stop();
    };
  }, [enabled, retry]);
  useEffect(
    () => runtime.current?.setReducedMotion(reducedMotion),
    [reducedMotion],
  );
  useEffect(() => {
    const rect = canvas.current?.getBoundingClientRect();
    if (rect)
      runtime.current?.resize(rect.width, rect.height, devicePixelRatio);
  }, [displayScale]);
  const lastAction = useRef("");
  useEffect(() => {
    if (!loaded || !actionRequest || lastAction.current === actionRequest.id)
      return;
    lastAction.current = actionRequest.id;
    try {
      runtime.current?.play(actionRequest.action);
    } catch (e) {
      setError(String(e));
    }
  }, [actionRequest, loaded]);
  return (
    <div className="haru-character" data-loaded={loaded && enabled && !error}>
      {enabled && !error && (
        <canvas
          key={retry}
          ref={canvas}
          aria-label={`${displayName} Live2D 角色`}
          onClick={onInteract}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            runtime.current?.setPointer(
              ((e.clientX - r.left) / r.width) * 2 - 1,
              1 - ((e.clientY - r.top) / r.height) * 2,
            );
          }}
          onPointerLeave={() => runtime.current?.setPointer(0, 0)}
        />
      )}
      {!loaded && !error && enabled && (
        <span className="haru-loading">{displayName} 正在准备中…</span>
      )}
      {error && (
        <div className="haru-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            重试
          </button>
          <button
            onClick={() =>
              void window.buddy
                .setPreferences({ character: "assistant" })
                .catch((e) => setError(e.message))
            }
          >
            切回原角色
          </button>
        </div>
      )}
    </div>
  );
}
