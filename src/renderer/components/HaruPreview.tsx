import { useEffect, useRef, useState } from "react";
import HaruCharacter from "../characters/live2d/HaruCharacter";
import { haruActions } from "../characters/live2d/actions";
import type { HaruAction } from "../characters/live2d/types";
export default function HaruPreview({
  displayName = "丝袜妹",
  reducedMotion,
  onClose,
}: {
  displayName?: string;
  reducedMotion: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [request, setRequest] = useState<{ id: string; action: HaruAction }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const play = (action: HaruAction) =>
    setRequest({ id: crypto.randomUUID(), action });
  async function select() {
    setBusy(true);
    try {
      await window.buddy.setPreferences({ character: "haru" });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="haru-preview-dialog"
      aria-label={`${displayName} 角色预览`}
      onCancel={onClose}
    >
      <div className="haru-preview-heading">
        <div>
          <h2>认识 {displayName}</h2>
          <p className="muted">轻轻眨眼，安静陪你。原地陪伴 · 全程无声</p>
        </div>
        <button aria-label="关闭预览" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="haru-preview-layout">
        <div className="haru-preview-stage">
          <HaruCharacter
            displayName={displayName}
            reducedMotion={reducedMotion}
            actionRequest={request}
            onInteract={() => play(haruActions.tap[0])}
          />
        </div>
        <div className="haru-preview-options">
          <h3>自然待机</h3>
          <div className="haru-action-grid">
            {haruActions.idle.map((a, i) => (
              <button key={i} onClick={() => play(a)}>
                待机 {i + 1}
              </button>
            ))}
          </div>
          <h3>点击互动</h3>
          <div className="haru-action-grid">
            {haruActions.tap.map((a, i) => (
              <button key={i} onClick={() => play(a)}>
                互动 {i + 1}
              </button>
            ))}
          </div>
          <h3>表情试穿</h3>
          <div className="haru-action-grid">
            {haruActions.expressions.map((e) => (
              <button key={e.label} onClick={() => play(e.action)}>
                {e.label}
              </button>
            ))}
          </div>
          <p className="hint">
            {reducedMotion
              ? "已开启减少动画：仅展示静态表情。"
              : "这些是模型原有的动作与表情。当前模型暂无行走动作。"}
          </p>
          <details>
            <summary>模型来源与使用说明</summary>
            <p>Haru © Live2D Inc. · Cubism SDK 5-r.5</p>
            <p>
              本应用使用 Live2D Inc.
              拥有著作权的示例数据，并依照其规定的使用条件使用。本应用内容由作者自行制作。
            </p>
            <p>
              资源来自 Live2D 官方 SDK，适用 Core、Open Software、Free Material
              及示例模型使用条款。完整声明随安装包保存在
              resources/live2d/licenses 中。
            </p>
            <p>
              官方条款：www.live2d.com/eula/live2d-sample-model-terms_en.html
            </p>
          </details>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => void select()}
          >
            使用 {displayName}
          </button>
        </div>
      </div>
    </dialog>
  );
}
