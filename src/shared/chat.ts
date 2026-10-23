import { z } from "zod";
import { characterOrder, type Live2dKind } from "./characters";
export const chatKindSchema = z.enum(
  characterOrder as [Live2dKind, ...Live2dKind[]],
);
export const messageSchema = z.object({
  id: z.string().max(100),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(16000),
  at: z.number().finite(),
  status: z.enum(["complete", "streaming", "stopped", "error"]),
  error: z.string().max(300).optional(),
});
export type ChatMessage = z.infer<typeof messageSchema>;
export type ChatState = {
  version: 1;
  sessions: Record<Live2dKind, ChatMessage[]>;
  active: { kind: Live2dKind; id: string } | null;
  notice?: string;
};
export function emptyChat(): ChatState {
  return {
    version: 1,
    sessions: Object.fromEntries(
      characterOrder.map((k) => [k, [] as ChatMessage[]]),
    ) as ChatState["sessions"],
    active: null,
  };
}
export function contextMessages(messages: ChatMessage[]) {
  let size = 0;
  const result: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages
    .filter((m) => m.status === "complete" && m.content)
    .slice(-20)
    .reverse()) {
    if (size + m.content.length > 16000) break;
    result.unshift({ role: m.role, content: m.content });
    size += m.content.length;
  }
  return result;
}
export const chatRequestSchema = z
  .object({
    kind: chatKindSchema,
    name: z.string().trim().min(1).max(40),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(16000),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((v) => v.messages.reduce((n, m) => n + m.content.length, 0) <= 16000);
