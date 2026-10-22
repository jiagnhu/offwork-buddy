import { useEffect, useState } from "react";
import type { Preferences } from "../../shared/model";
import {
  characterName,
  normalizeCharacter,
  live2dModels,
} from "../../shared/characters";

export function CompanionNameSetting({
  preferences: p,
}: {
  preferences: Preferences;
}) {
  const kind = normalizeCharacter(p.character),
    saved = characterName(kind, p);
  const [name, setName] = useState(saved);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(saved);
    setError("");
  }, [kind, saved]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await window.buddy.setPreferences(
            kind === "haru"
              ? { haruName: name.trim() }
              : { characterNames: { [kind]: name.trim() } },
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field-title">
        {live2dModels[kind].name} 的昵称
        <input
          aria-label="看板娘名称"
          value={name}
          maxLength={20}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="secondary"
        disabled={busy || !name.trim() || name.trim() === saved}
      >
        保存名称
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function RestReminderSetting({
  preferences: p,
}: {
  preferences: Preferences;
}) {
  const current = p.reminders.restMinutes ?? 0;
  const [minutes, setMinutes] = useState(String(current || 60));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (current) setMinutes(String(current));
  }, [current]);
  async function save(value: number) {
    setBusy(true);
    setError("");
    try {
      await window.buddy.setPreferences({
        reminders: { ...p.reminders, restMinutes: value },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(Number(minutes));
      }}
    >
      <label className="toggle-row">
        定时休息提醒
        <input
          type="checkbox"
          role="switch"
          checked={current > 0}
          disabled={busy}
          onChange={(e) => void save(e.target.checked ? 60 : 0)}
        />
      </label>
      {current > 0 && (
        <>
          <label className="field-title">
            每隔多少分钟
            <input
              aria-label="休息提醒间隔（分钟）"
              type="number"
              min={5}
              max={240}
              step={1}
              required
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={busy || Number(minutes) === current}
          >
            保存提醒间隔
          </button>
        </>
      )}
      <p className="hint">
        {current > 0 ? `已开启：每 ${current} 分钟提醒。` : "当前已关闭。"}
        从上午、下午上班时间分别计时，午休、下班及非工作日不提醒；隐藏伙伴时不打扰。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
