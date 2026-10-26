# Story and Memory Implementation Plan

> Use superpowers:executing-plans inline. User approved the design and explicitly said “实现”; implement continuously without another planning approval.

**Goal:** Ship seven complete personal stories, a joint story, and evidence-backed persistent memory with existing desktop chat.
**Architecture:** Versioned narrative state inside the atomic chat document. Pure authored-graph reducer and memory functions; main process owns transactions. AI classifies bounded intent and proposes sourced memories, never writes arbitrary events. UI uses lazy narrative drawer and shared scene controls.
**Tech Stack:** Existing Electron, React, TypeScript, Zod, Vitest and Playwright; no new service/database.
**Spec:** docs/superpowers/specs/2026-10-26-story-memory-design.md

## Global Constraints

- Seven personal arcs, each >=8 reachable nodes, >=3 consequential choices and >=3 endings; joint >=10 nodes and >=4 endings.
- Max 20 world saves. Real memories isolated by stable character ID; fictional episodes isolated by world and known audience.
- Recall <=8 memories /2400 chars; clicks <=2 non-sensitive relevant memories. No inferred user facts from assistant text.
- Preserve old records/nicknames/settings; destructive UI actions confirm exact scope. No accounts, voice, model switching, or new motions.
- Never expose configured credentials in logs/tests. Keep unrelated untracked files untouched.

## Review Focus

- Deletion racing background extraction or import: no resurrection.
- Repeating or replaying choice requests from stale worlds: no duplicate events or wrong-world mutation.
- Cross-world daily messages and other actors' dialogue: no knowledge leakage.
- Failed save/stream/backup restore: retain durable facts and report what actually saved.
- Arbitrary model JSON, quotation, negation and third-party statements: do not become privileged actions or invented user memories.

## Task 1: Persistent schema and sourced memory

Files: src/shared/narrative.ts, src/shared/chat.ts, src/core/memory.ts, src/main/chat-store.ts; tests/memory.test.ts, tests/chat-store.test.ts.
Interfaces: NarrativeState; emptyNarrative(); remember(state, kind, candidate, sources); forgetMemory(); recallMemories(); migrate old chat version 1 to version 2.
- [x] Write failing tests for source validation, third-party/hypothetical rejection, correction/suppression, isolation and old file migration.
- [x] Run focused tests and observe missing behavior.
- [x] Implement bounded schemas, local matching, verified citations, sensitive/credential filtering, deletion exclusions and atomic serialization.
- [x] Run focused tests/typecheck, inspect results, commit scoped changes.

## Task 2: Authored graph and deterministic worlds

Files: src/shared/story-catalog.ts, src/core/story-engine.ts; tests/story-engine.test.ts.
Interfaces: storyCatalog, createWorld(), enterStory(), chooseStory(), shareEvidence(), forkWorld(), storyContext(); all mutations check expected revision and operation IDs.
- [x] Write failing reachability, endings, evidence guard, idempotency, branch fork and knowledge tests.
- [x] Author distinct scenes/choices/ending consequences for seven roles and joint story; implement reducer and source-aware knowledge views.
- [x] Run graph exploration proving each ending and no missing targets; test Miara evidence and absence constraints.
- [x] Commit content plus verified engine.

## Task 3: Chat, AI and background memory integration

Files: src/main/chat-controller.ts, src/main/narrative-ai.ts, src/server/chat-server.ts, src/server/character-prompt.ts, src/shared/chat.ts, src/main/interaction-reply.ts; tests/narrative-chat.test.ts, tests/chat-server.test.ts.
Interfaces: bounded analysis tasks use existing transport with purpose; narrative context validated before prompt inclusion. ChatController owns narrativeAction(), background cancellation and scene-aware messages.
- [ ] Write failing integration tests for >20-message recall, explicit remember/forget acknowledgement, pause, story input, cancellation, stale jobs and save failure.
- [ ] Add separate structured analysis prompt/response validation; scheduled extraction never blocks foreground; explicit commands commit before confirming.
- [ ] Add scene/world context, actor attribution, choice proposals for ambiguous input, no story facts from prose, retry without choice replay.
- [ ] Run focused integration tests and complete unit suite/typecheck; commit.

## Task 4: UI, IPC and backup

Files: src/shared/bridge.ts, src/preload/index.ts, src/main/index.ts, src/main/backup.ts, src/renderer/components/NarrativeDrawer.tsx, StoryScene.tsx, src/renderer/pages/Chat.tsx, DesktopChat.tsx, src/renderer/components/HaruPreview.tsx, new narrative CSS.
Interfaces: getNarrative/onChat state; narrativeAction({operation, expectedRevision,...}); existing backup envelope gains validated chat/narrative state.
- [ ] Add behavior tests for backup migration/rollback and desktop story-memory interactions before implementation.
- [ ] Implement lazy drawer with stories, saves/forks, evidence, memory/source management, delete confirmations and auto-memory toggle; shared scene card and entry proposals.
- [ ] Include narrative in export/import, preserving it on legacy imports; stop generation/jobs before replacement.
- [ ] Verify UI with Electron and screenshot; no model reload or navigation regressions; commit.

## Task 5: Review and release

- [ ] Run full unit suite, typecheck, build and focused desktop regressions.
- [ ] Dispatch one fresh whole-change reviewer per executing-plans; fix material findings with regression evidence.
- [ ] Run available live-model smoke without exposing keys; if unavailable document exact limitation rather than fabricate validation.
- [ ] Bump 1.12.0, build installer, run packaged smoke, record evidence/hash and commit release documentation.

## Execution ledger

Base: 2115cbb. Current checkout is the established codex/desktop-companion development branch; reuse it as authorized instead of adding a new checkout. No implementation delegation; final independent review only.
Ruling: Use this tracked plan as the progress ledger on Windows; no shell-specific scratch helper is needed. One atomic chat payload owns narrative state so a choice and its receipt cannot diverge.
Pre-flight: Tasks 1/2 produce shared typed state for 3; 3 exposes controller actions for 4; IPC only accepts schema-validated operations. UI never sets flags or arbitrary memory facts.

Task 1 complete: 78e492d; migration red (version 1 != 2), memory module absent, then 6 focused tests green and typecheck green.
Task 2 complete: graph module absent red; 5 graph tests green, covering all 63 personal nodes/21 endings and 12 joint nodes/4 endings through real acquired evidence. Typecheck green after fixing fixture share-policy fields.
Ruling: Split streaming session ownership into chat-session.ts while retaining transport exports in chat-controller.ts — keeps protocol and durable state manageable; external constructor/API remains compatible.
Task 3 in progress: explicit memory / story integration red then 7 controller tests green. Full suite at this checkpoint 181 passed, typecheck green.
