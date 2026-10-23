export function mountResource<T extends { dispose(): void }>(
  load: (signal: AbortSignal) => Promise<T>,
  ready: (resource: T) => void,
  error: (e: Error) => void,
) {
  const controller = new AbortController();
  let resource: T | undefined;
  void load(controller.signal)
    .then((value) => {
      if (controller.signal.aborted) value.dispose();
      else {
        resource = value;
        ready(value);
      }
    })
    .catch((e) => {
      if (!controller.signal.aborted)
        error(e instanceof Error ? e : new Error(String(e)));
    });
  return () => {
    controller.abort();
    resource?.dispose();
    resource = undefined;
  };
}
export function frameLoop(draw: (delta: number) => void) {
  let raf = 0,
    reduced = true,
    paused = false,
    disposed = false,
    last = -Infinity,
    deadline = -Infinity;
  const tick = (now: number) => {
    if (disposed || reduced || paused) return;
    if (now + 0.001 >= deadline) {
      const dt = Number.isFinite(last)
        ? Math.min((now - last) / 1000, 0.1)
        : 1 / 30;
      const interval = 1000 / 30;
      deadline = Number.isFinite(deadline)
        ? deadline +
          (Math.floor(Math.max(0, now - deadline + 0.001) / interval) + 1) *
            interval
        : now + interval;
      last = now;
      draw(dt);
    }
    if (!disposed && !reduced && !paused) raf = requestAnimationFrame(tick);
  };
  return {
    setPaused(value: boolean) {
      if (disposed || paused === value) return;
      paused = value;
      cancelAnimationFrame(raf);
      raf = 0;
      last = deadline = -Infinity;
      if (!paused) {
        if (reduced) draw(0);
        else raf = requestAnimationFrame(tick);
      }
    },
    setReduced(value: boolean) {
      if (disposed) return;
      reduced = value;
      cancelAnimationFrame(raf);
      raf = 0;
      last = -Infinity;
      deadline = -Infinity;
      if (paused) return;
      if (value) draw(0);
      else raf = requestAnimationFrame(tick);
    },
    invalidate() {
      if (!disposed && reduced && !paused) draw(0);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
