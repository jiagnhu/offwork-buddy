import { useEffect, useState } from "react";
import type { Snapshot } from "../../shared/model";
export function useSnapshot(pauseWhenHidden = false) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true,
      visible = true,
      visibilityRevision = 0,
      revision = 0;
    const refresh = () => {
      const before = revision;
      void window.buddy
        .getSnapshot()
        .then((s) => {
          if (live && visible && before === revision) setSnapshot(s);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    };
    const off = window.buddy.onSnapshot((s) => {
      revision++;
      if (live && visible) setSnapshot(s);
    });
    const offVisibility = pauseWhenHidden
      ? window.buddy.onWindowVisibility((v) => {
          visibilityRevision++;
          visible = v;
          revision++;
          if (v) refresh();
        })
      : () => {};
    // Allow one initial snapshot while the window is preparing to show.
    refresh();
    if (pauseWhenHidden) {
      const before = visibilityRevision;
      void window.buddy
        .getWindowVisibility()
        .then((v) => {
          if (live && visibilityRevision === before) {
            visible = v;
            revision++;
            if (v) refresh();
          }
        })
        .catch(() => {});
    }
    return () => {
      live = false;
      off();
      offVisibility();
    };
  }, [pauseWhenHidden]);
  return { snapshot, error };
}
