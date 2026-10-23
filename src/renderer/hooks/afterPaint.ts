// Let the browser present the navigation shell before mounting page content.
export function afterPaint(callback: () => void) {
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        if (!cancelled) callback();
      }, 0);
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
}
