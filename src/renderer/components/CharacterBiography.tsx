import lore from "../../shared/character-lore.generated.json";
import type { Live2dKind } from "../../shared/characters";

export default function CharacterBiography({ kind }: { kind: Live2dKind }) {
  const sections = lore.characters[kind].biography
    .split(/\n## /)
    .slice(1)
    .filter((section) =>
      [
        "身份档案",
        "人生履历",
        "性格结构",
        "日常生活",
        "私人生活",
        "关系与秘密",
      ].includes(section.split("\n")[0]),
    );
  return (
    <div className="character-biography">
      <p className="muted">
        《最后一班之前》·
        应用原创故事，非模型官方设定。以下包含人物秘密与剧情信息。
      </p>
      {sections.map((section) => {
        const [heading, ...body] = section.split("\n");
        return (
          <section key={heading}>
            <h4>{heading}</h4>
            <div>
              {body
                .join("\n")
                .replace(/^- 稳定 ID：[a-z]+。\s*/gm, "")
                .split("\n")
                .filter((line) => !line.includes("系统允许昵称"))
                .join("\n")
                .replace(/\*\*/g, "")
                .replace(/^[-] /gm, "• ")}
            </div>
          </section>
        );
      })}
    </div>
  );
}
