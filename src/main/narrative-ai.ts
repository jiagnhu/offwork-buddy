import { z } from "zod";
import {
  memoryCandidateSchema,
  type NarrativeState,
} from "../shared/narrative";
import type { Live2dKind } from "../shared/characters";
import type { ChatMessage } from "../shared/chat";
import type { Transport } from "./chat-controller";
import type { StoryChoice } from "../shared/story-catalog";

export function parseModelJson(text: string): unknown {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (clean.length > 12000) throw Error("分析结果过长");
  return JSON.parse(clean);
}
export async function extractMemories(
  transport: Transport,
  kind: Live2dKind,
  name: string,
  sources: ChatMessage[],
  state: NarrativeState,
  signal: AbortSignal,
) {
  let text = "";
  await transport(
    {
      kind,
      name,
      purpose: "memory",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            sources: sources.map((s) => ({ id: s.id, text: s.content })),
            existingTopics: state.memories[kind]
              .filter((m) => m.status === "active")
              .slice(-50)
              .map((m) => m.topic),
          }),
        },
      ],
    },
    signal,
    (delta) => {
      text += delta;
      if (text.length > 12000) throw Error("分析结果过长");
    },
  );
  return z
    .object({ memories: z.array(memoryCandidateSchema).max(8) })
    .parse(parseModelJson(text)).memories;
}
export async function suggestChoice(
  transport: Transport,
  kind: Live2dKind,
  name: string,
  input: string,
  choices: StoryChoice[],
  signal: AbortSignal,
) {
  let text = "";
  await transport(
    {
      kind,
      name,
      purpose: "intent",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            input,
            choices: choices.map((c) => ({ id: c.id, label: c.label })),
          }),
        },
      ],
    },
    signal,
    (delta) => {
      text += delta;
      if (text.length > 2000) throw Error("分析结果过长");
    },
  );
  const data = z
    .object({ choiceId: z.string().max(100).nullable() })
    .parse(parseModelJson(text));
  return choices.find((c) => c.id === data.choiceId);
}
