import { z } from "zod";
import { characterOrder, type Live2dKind } from "./characters";

export const actorSchema = z.enum(characterOrder as [Live2dKind, ...Live2dKind[]]);
export const arcSchema = z.enum([...characterOrder, "joint"] as [Live2dKind, ...Live2dKind[], "joint"]);
export type ArcId = z.infer<typeof arcSchema>;
const id = z.string().min(1).max(100);
export const messageSchema = z.object({
  id, role: z.enum(["user", "assistant"]), content: z.string().max(16000),
  at: z.number().finite(), status: z.enum(["complete", "streaming", "stopped", "error"]),
  error: z.string().max(300).optional(), actor: actorSchema.optional(),
  worldId: id.nullable().optional(), arc: arcSchema.optional(), eventIndex: z.number().int().nonnegative().optional(),
  memoryIds: z.array(id).max(8).optional(), local: z.boolean().optional(),
});
export type NarrativeMessage = z.infer<typeof messageSchema>;
export const memoryCandidateSchema = z.object({
  sourceId: id, quote: z.string().trim().min(3).max(300), topic: z.string().trim().min(1).max(40),
  category: z.enum(["preference", "background", "goal", "agreement"]),
});
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export const memorySchema = z.object({
  id, kind: actorSchema, topic: z.string().max(40), category: memoryCandidateSchema.shape.category,
  text: z.string().max(300), sourceId: id, sourceText: z.string().max(2000),
  at: z.number().finite(), updatedAt: z.number().finite(),
  status: z.enum(["active", "superseded", "uncertain"]), explicit: z.boolean(), sensitive: z.boolean(),
});
export type Memory = z.infer<typeof memorySchema>;
export const evidenceSchema = z.object({
  id, title: z.string().max(100), text: z.string().max(1200),
  type: z.enum(["clue", "claim", "confirmed"]), owner: actorSchema,
  knownBy: z.array(actorSchema).max(7), public: z.boolean(), eventId: id,
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const storyEventSchema = z.object({
  id, opId: id, at: z.number().finite(), arc: arcSchema,
  from: id, to: id, choice: id, text: z.string().max(2000),
  grants: z.array(evidenceSchema).max(5), flags: z.array(z.string().max(100)).max(12),
  audience: z.array(actorSchema).max(7), shareId: id.optional(),
});
export type StoryEvent = z.infer<typeof storyEventSchema>;
export const worldSchema = z.object({
  id, name: z.string().trim().min(1).max(60), contentVersion: z.literal(1), revision: z.number().int().nonnegative(),
  createdAt: z.number().finite(), archived: z.boolean(),
  tracks: z.record(z.string().max(100)), activeArc: arcSchema.nullable(), paused: z.boolean(),
  events: z.array(storyEventSchema).max(2000), evidence: z.array(evidenceSchema).max(100),
  flags: z.array(z.string().max(100)).max(300), messages: z.array(messageSchema).max(1500),
});
export type StoryWorld = z.infer<typeof worldSchema>;
export const narrativeSchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative(), autoMemory: z.boolean(),
  selectedWorldId: id.nullable(), worlds: z.array(worldSchema).max(20),
  memories: z.record(z.array(memorySchema).max(500)),
  excluded: z.record(z.array(id).max(20000)), processed: z.record(z.array(id).max(2000)),
});
export type NarrativeState = z.infer<typeof narrativeSchema>;
export function emptyNarrative(): NarrativeState {
  const lists = <T>() => Object.fromEntries(characterOrder.map(k => [k, [] as T[]]));
  return { version: 1, revision: 0, autoMemory: true, selectedWorldId: null, worlds: [], memories: lists<Memory>(), excluded: lists<string>(), processed: lists<string>() };
}
export function selectedWorld(state: NarrativeState) {
  return state.worlds.find(w => w.id === state.selectedWorldId);
}

export const narrativeActionSchema = z.object({
  type: z.enum(["create", "select", "enter", "pause", "choose", "share", "fork", "archive", "deleteWorld", "forget", "clearMemory", "autoMemory", "organize"]),
  revision: z.number().int().nonnegative(), opId: id,
  worldId: id.optional(), arc: arcSchema.optional(), choiceId: id.optional(), evidenceId: id.optional(),
  eventId: id.optional(), memoryId: id.optional(), name: z.string().trim().min(1).max(60).optional(),
  audience: z.array(actorSchema).max(7).optional(), enabled: z.boolean().optional(),
});
export type NarrativeAction = z.infer<typeof narrativeActionSchema>;

export const narrativeContextSchema = z.object({
  memories: z.array(z.object({ text: z.string().max(300), at: z.number().finite(), category: z.string().max(30) })).max(8),
  story: z.string().max(6000).optional(), savedOperation: z.string().max(500).optional(),
});
export type NarrativeContext = z.infer<typeof narrativeContextSchema>;
