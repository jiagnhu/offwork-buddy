import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { Snapshot } from "../../shared/model";
import {
  characterName,
  characterOrder,
  normalizeCharacter,
  live2dModels,
  type Live2dKind,
} from "../../shared/characters";
import { SharedCharacterSlot } from "../components/SharedCharacter";
import HaruPreview from "../components/HaruPreview";
import { CompanionNameSetting } from "../components/CompanionSettings";

const profiles = {
  tororo: {
    portrait: new URL("../assets/characters/tororo.png", import.meta.url).href,
    description: "软萌白猫，悠闲相伴",
    tone: "honey",
  },
  hijiki: {
    portrait: new URL("../assets/characters/hijiki.png", import.meta.url).href,
    description: "乖巧黑猫，自在陪伴",
    tone: "blue",
  },
  haru: {
    portrait: new URL("../assets/characters/haru.png", import.meta.url).href,
    description: "温柔回应，细腻表情",
    tone: "rose",
  },
  hiyori: {
    portrait: new URL("../assets/characters/hiyori.png", import.meta.url).href,
    description: "日常陪伴，自然神态",
    tone: "honey",
  },
  mao: {
    portrait: new URL("../assets/characters/mao.png", import.meta.url).href,
    description: "俏皮灵动，魔法庆祝",
    tone: "violet",
  },
  miara: {
    portrait: new URL("../assets/characters/miara.png", import.meta.url).href,
    description: "轻盈舒展，精灵相伴",
    tone: "mint",
  },
  rice: {
    portrait: new URL("../assets/characters/rice.png", import.meta.url).href,
    description: "安静倾听，书页与魔法",
    tone: "blue",
  },
} as const;

export default function CharacterSpace({ snapshot }: { snapshot: Snapshot }) {
  const p = snapshot.state.preferences;
  const current = normalizeCharacter(p.character);
  const name = characterName(current, p);
  const [preview, setPreview] = useState<Live2dKind | null>(null);
  return (
    <div className="character-space">
      <section className="card character-current" aria-label="当前角色">
        <span className="character-status">
          <span />
          正在陪伴
        </span>
        <div className="character-space-stage">
          <SharedCharacterSlot paused={!!preview} />
        </div>
        <h2>{name}</h2>
        {name !== live2dModels[current].name && (
          <small className="muted">模型 · {live2dModels[current].name}</small>
        )}
        <p className="muted">{profiles[current].description}</p>
        <button className="primary" onClick={() => setPreview(current)}>
          <Sparkles size={16} />
          试试动作
        </button>
        <div className="character-name-setting">
          <CompanionNameSetting key={current} preferences={p} />
        </div>
      </section>
      <section className="character-library" aria-label="选择角色">
        <div className="section-title">
          <div>
            <h2>选择角色</h2>
          </div>
        </div>
        <div className="character-library-grid">
          {characterOrder.map((kind) => {
            const selected = current === kind;
            return (
              <button
                key={kind}
                className="character-choice"
                data-tone={profiles[kind].tone}
                aria-label={`预览 ${characterName(kind, p)}`}
                aria-pressed={selected}
                onClick={() => setPreview(kind)}
              >
                <span className="character-portrait">
                  <img
                    src={profiles[kind].portrait}
                    alt={`${live2dModels[kind].name} 角色立绘`}
                    draggable={false}
                  />
                  {selected && (
                    <span className="character-selected">
                      <Check size={12} />
                      陪伴中
                    </span>
                  )}
                </span>
                <strong>{characterName(kind, p)}</strong>
                {characterName(kind, p) !== live2dModels[kind].name && (
                  <small className="character-original">
                    {live2dModels[kind].name}
                  </small>
                )}
                <span className="character-description">
                  {profiles[kind].description}
                </span>
                <span className="character-preview-link">
                  认识一下 <span aria-hidden="true">↗</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {preview && (
        <HaruPreview
          key={preview}
          kind={preview}
          displayName={characterName(preview, p)}
          reducedMotion={p.reducedMotion}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
