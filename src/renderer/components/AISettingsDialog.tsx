import { useEffect, useRef, useState } from "react";
import type { AISettingsView } from "../../shared/ai-settings";
export default function AISettingsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null),
    [view, setView] = useState<AISettingsView | null>(null),
    [key, setKey] = useState(""),
    [baseURL, setBaseURL] = useState(""),
    [model, setModel] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    let live = true;
    void window.buddy
      .getAISettings()
      .then((s) => {
        if (!live) return;
        setView(s);
        setBaseURL(s.baseURL);
        setModel(s.model);
      })
      .catch(() => {
        if (live) setError("设置读取失败，请重新打开。");
      });
    return () => {
      live = false;
    };
  }, []);
  async function run(test: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const input = { key, baseURL, model };
      if (test) setMessage(await window.buddy.testAISettings(input));
      else {
        const s = await window.buddy.saveAISettings(input);
        setView(s);
        setKey("");
        setMessage("设置已加密保存，本机 AI 服务已启动。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="ai-settings-dialog"
      aria-label="AI 服务设置"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="section-title">
        <h2>
          AI 服务设置 <small>开发版</small>
        </h2>
        <button
          className="icon-button"
          aria-label="关闭 AI 设置"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="muted">
        统一使用百炼千问。保存后自动启动服务，下次打开软件会自动恢复。
      </p>
      {view?.notice && (
        <p role="alert" className="notice">
          {view.notice}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
      >
        <fieldset disabled={!view || !view.enabled || busy}>
          <label>
            百炼 API Key
            <input
              type="password"
              aria-label="百炼 API Key"
              autoComplete="off"
              spellCheck={false}
              value={key}
              maxLength={2048}
              placeholder={
                view?.hasKey ? "已保存，留空则保持原密钥" : "输入百炼 API Key"
              }
              onChange={(e) => {
                setKey(e.target.value);
                setMessage("");
              }}
            />
          </label>
          <small>
            {view?.hasKey
              ? "密钥已加密保存，不回显原值。"
              : "密钥使用系统加密保存，不进入聊天记录。"}
          </small>
          <label>
            服务地址
            <input
              aria-label="百炼服务地址"
              value={baseURL}
              onChange={(e) => {
                setBaseURL(e.target.value);
                setMessage("");
              }}
              placeholder="https://…/compatible-mode/v1"
              required
            />
          </label>
          <label>
            模型标识
            <input
              aria-label="百炼模型标识"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setMessage("");
              }}
              placeholder="填写百炼控制台中已开通的千问模型标识"
              required
              maxLength={120}
            />
          </label>
          <p className="muted">
            地址、密钥与模型需属于相同地域。测试连接会发送一条极短请求，可能产生少量
            API 费用。
          </p>
          <div className="ai-settings-actions">
            <button
              type="button"
              className="secondary"
              disabled={!model || !baseURL || (!key && !view?.hasKey)}
              onClick={() => void run(true)}
            >
              测试连接
            </button>
            <button
              className="primary"
              disabled={!model || !baseURL || (!key && !view?.hasKey)}
            >
              保存并启用
            </button>
          </div>
        </fieldset>
      </form>
      {busy && <p role="status">正在处理，请稍候…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </dialog>
  );
}
