import { useEffect, useState } from "react";
import type { Snapshot } from "../../shared/model";
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    window.buddy
      .getSnapshot()
      .then((s) => {
        if (live) setSnapshot(s);
      })
      .catch((e) => setError(e.message));
    const off = window.buddy.onSnapshot((s) => {
      if (live) setSnapshot(s);
    });
    return () => {
      live = false;
      off();
    };
  }, []);
  return { snapshot, error };
}
