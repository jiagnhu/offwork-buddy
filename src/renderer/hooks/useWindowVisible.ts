import { useEffect, useState } from "react";
export function useWindowVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let mounted = true,
      revision = 0,
      native = false;
    const update = () => {
      if (mounted) setVisible(native && document.visibilityState !== "hidden");
    };
    const unsubscribe = window.buddy.onWindowVisibility((v) => {
      revision++;
      native = v;
      update();
    });
    const start = revision;
    void window.buddy
      .getWindowVisibility()
      .then((v) => {
        if (mounted && revision === start) {
          native = v;
          update();
        }
      })
      .catch(() => {});
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return visible;
}
