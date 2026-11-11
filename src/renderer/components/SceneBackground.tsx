import { useEffect, useState } from "react";
import overview from "../assets/theme/overview.webp";
import calendar from "../assets/theme/calendar.webp";
import ledger from "../assets/theme/ledger.webp";
import chat from "../assets/theme/chat.webp";
import growth from "../assets/theme/terrace.webp";
import settings from "../assets/theme/settings.webp";

const scenes: Record<string, string> = {
  overview,
  calendar,
  ledger,
  chat,
  growth,
  settings,
};
const decoded = new Map<string, Promise<HTMLImageElement>>();
function prepareScene(page: string) {
  let pending = decoded.get(page);
  if (!pending) {
    const image = new Image();
    image.src = scenes[page];
    pending = image
      .decode()
      .then(() => image)
      .catch((error) => {
        decoded.delete(page);
        throw error;
      });
    decoded.set(page, pending);
  }
  return pending;
}

export default function SceneBackground({
  page,
  reducedMotion,
}: {
  page: string;
  reducedMotion: boolean;
}) {
  const [ready, setReady] = useState<string | null>(null);
  const [layers, setLayers] = useState<string[]>([]);
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const still = reducedMotion || systemReduced;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Decode the small, bundled scene set off the navigation path. Keep decoded
    // images available so returning to a page doesn't expose an empty frame.
    const idle = requestIdleCallback(
      () => {
        for (const scene of Object.keys(scenes))
          void prepareScene(scene).catch(() => {});
      },
      { timeout: 1500 },
    );
    return () => cancelIdleCallback(idle);
  }, []);
  useEffect(() => {
    let current = true;
    setReady(null);
    const next = scenes[page] ? page : "overview";
    void prepareScene(next)
      .then(() => {
        if (current) setReady(next);
      })
      .catch(() => {
        // Preserve the last painted scene on a missing/failed asset. Retry on the
        // next visit; late loads from a previous menu must never replace this one.
      });
    return () => {
      current = false;
    };
  }, [page]);
  useEffect(() => {
    if (still) {
      const next = ready ?? layers.at(-1);
      if (next && (layers.length !== 1 || layers[0] !== next))
        setLayers([next]);
    } else if (ready && layers.length < 2 && layers[0] !== ready) {
      setLayers(layers.length ? [layers[0], ready] : [ready]);
    }
    // Finish an in-flight fade before revealing the latest requested scene.
    // Restarting opacity midway through rapid clicks would cause another flash.
  }, [ready, layers, still]);
  return (
    <div className="app-scene" aria-hidden="true">
      {layers.map((scene, index) => (
        <img
          key={scene}
          data-scene={scene}
          className={index === 1 ? "scene-incoming" : undefined}
          src={scenes[scene]}
          alt=""
          draggable={false}
          onAnimationEnd={(event) => {
            if (event.animationName === "scene-reveal")
              setLayers((active) => (active[1] === scene ? [scene] : active));
          }}
        />
      ))}
    </div>
  );
}
