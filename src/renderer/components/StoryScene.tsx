import type { ChatState } from "../../shared/chat";
import type { Live2dKind } from "../../shared/characters";
import { selectedWorld, type NarrativeAction } from "../../shared/narrative";
import { storyCatalog } from "../../shared/story-catalog";
import { availableChoices } from "../../core/story-engine";
import "../styles/narrative.css";
export default function StoryScene({
  chat,
  kind,
  onAction,
  busy = false,
}: {
  chat: ChatState;
  kind: Live2dKind;
  onAction: (input: NarrativeAction) => Promise<unknown>;
  busy?: boolean;
}) {
  const world = selectedWorld(chat.narrative),
    arc = world?.activeArc;
  const offer = chat.offer?.kind === kind ? chat.offer : undefined;
  const action = (
    type: NarrativeAction["type"],
    extra: Partial<NarrativeAction> = {},
  ) =>
    void onAction({
      type,
      revision: chat.narrative.revision,
      opId: crypto.randomUUID(),
      worldId: world?.id,
      ...extra,
    });
  if (!world || !arc || world.paused || (arc !== "joint" && arc !== kind))
    return null;
  const node = storyCatalog[arc].nodes[world.tracks[arc]];
  if (!node) return null;
  return (
    <section className="story-scene" aria-label="当前故事场景">
      <div className="story-scene-top">
        <span>故事 · {node.location}</span>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => action("pause")}
        >
          先聊别的
        </button>
      </div>
      <h3>{node.title}</h3>
      <p>{node.text}</p>
      {node.ending ? (
        <p className="story-ending">这一段故事已结束</p>
      ) : (
        <div className="story-choices">
          {availableChoices(world, arc).map((c) => (
            <button
              type="button"
              className="secondary"
              key={c.id}
              disabled={busy}
              onClick={() => action("choose", { arc, choiceId: c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {offer?.choiceId && (
        <div className="story-offer">
          <span>待确认：{offer.label}</span>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              action("choose", {
                arc: offer.arc,
                choiceId: offer.choiceId,
                revision: offer.revision,
              })
            }
          >
            确认这个行动
          </button>
        </div>
      )}
      {!node.ending && (
        <small>也可以自由输入想法。建议行动只有确认后才写入故事。</small>
      )}
    </section>
  );
}
