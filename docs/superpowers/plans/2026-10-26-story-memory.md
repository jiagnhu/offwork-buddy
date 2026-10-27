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
- [x] Write failing integration tests for >20-message recall, explicit remember/forget acknowledgement, pause, story input, cancellation, stale jobs and save failure.
- [x] Add separate structured analysis prompt/response validation; scheduled extraction never blocks foreground; explicit commands commit before confirming.
- [x] Add scene/world context, actor attribution, choice proposals for ambiguous input, no story facts from prose, retry without choice replay.
- [x] Run focused integration tests and complete unit suite/typecheck; commit.

## Task 4: UI, IPC and backup

Files: src/shared/bridge.ts, src/preload/index.ts, src/main/index.ts, src/main/backup.ts, src/renderer/components/NarrativeDrawer.tsx, StoryScene.tsx, src/renderer/pages/Chat.tsx, DesktopChat.tsx, src/renderer/components/HaruPreview.tsx, new narrative CSS.
Interfaces: getNarrative/onChat state; narrativeAction({operation, expectedRevision,...}); existing backup envelope gains validated chat/narrative state.
- [x] Add behavior tests for backup migration/rollback and desktop story-memory interactions before implementation.
- [x] Implement lazy drawer with stories, saves/forks, evidence, memory/source management, delete confirmations and auto-memory toggle; shared scene card and entry proposals.
- [x] Include narrative in export/import, preserving it on legacy imports; stop generation/jobs before replacement.
- [x] Verify UI with Electron and screenshot; no model reload or navigation regressions; commit.

## Task 5: Review and release

- [x] Run full unit suite, typecheck, build and focused desktop regressions.
- [x] Dispatch one fresh whole-change reviewer per executing-plans; fix material findings with regression evidence.
- [x] Run available live-model smoke without exposing keys; if unavailable document exact limitation rather than fabricate validation.
- [x] Bump 1.12.0, build installer, run packaged smoke, record evidence/hash and commit release documentation.

## Execution ledger

Base: 2115cbb. Current checkout is the established codex/desktop-companion development branch; reuse it as authorized instead of adding a new checkout. No implementation delegation; final independent review only.
Ruling: Use this tracked plan as the progress ledger on Windows; no shell-specific scratch helper is needed. One atomic chat payload owns narrative state so a choice and its receipt cannot diverge.
Pre-flight: Tasks 1/2 produce shared typed state for 3; 3 exposes controller actions for 4; IPC only accepts schema-validated operations. UI never sets flags or arbitrary memory facts.

Task 1 complete: 78e492d; migration red (version 1 != 2), memory module absent, then 6 focused tests green and typecheck green.
Task 2 complete: graph module absent red; 5 graph tests green, covering all 63 personal nodes/21 endings and 12 joint nodes/4 endings through real acquired evidence. Typecheck green after fixing fixture share-policy fields.
Ruling: Split streaming session ownership into chat-session.ts while retaining transport exports in chat-controller.ts — keeps protocol and durable state manageable; external constructor/API remains compatible.
Task 3 in progress: explicit memory / story integration red then 7 controller tests green. Full suite at this checkpoint 181 passed, typecheck green.

Task 3 complete: 187 unit tests / 46 files and typecheck passed. Tests cover durable recall after 22 additional turns, real forget suppression, save rollback, late extraction after clearing, stale actor rejection, world isolation and story history cleanup. Real-service smoke classified a paraphrased choice as verify and emitted one first-person candidate, excluding the hypothetical friend statement.

Task 4 complete: full backup migration/journal recovery tests pass; Electron story/memory/fork/restart test passes. Character cards and navigation pass (20–52 ms warm switching). Desktop bubble/input regression passes after updating the test mock to route new background memory requests separately. Profiling exposed pre-existing cold shader compilation (5.6 s in GPU shader/program status calls); capability-gated Cubism 5.3 blend programs, then original 5-second character-card check passed without loosening its timeout. Removed the speculative afterPaint workaround and diagnostic-only test.

Final review: one fresh read-only gpt-6-astra reviewer, base 2115cbb..1cd23b6. Three Important findings, no Critical or Minor findings.
Final: fixed negation/attribution fragments becoming facts — transport-produced candidate regression RED→GREEN, suite 192/192.
Final: fixed individual/bulk forgetting missing world-only derived replies — two retention + restart regressions RED→GREEN, suite 192/192. Exclusions now cover all retained actor dialogue and compact obsolete IDs.
Final: fixed cumulative limited evidence disclosure — cumulative recipients and import replay regression RED→GREEN, suite 192/192. Limited means owner plus at most two other readers.
Final: Ruling: Import revisions and preview-role handling considered by reviewer without a proven finding — executor reproduced import revision collision and fixed durable revision advancement (RED→GREEN); preview actions retain explicit actor checks and switch before story entry. Cost if wrong: rejected stale preview action, not another role mutation.
Final: Ruling: Literary quality — keep seven authored, canon-aligned arcs and consequential evidence gates, with all nodes/endings exercised; subjective prose quality remains editorial judgement. Cost if wrong: later content revision, not altered saved facts.
Final: Ruling: Live model behavior — synthetic live smoke covers three voices, extraction, intent and recall; no claim of perfect semantic understanding or hallucination-free dialogue. Cost if wrong: a response or memory candidate can still need user correction.
Final: Ruling: Packaged behavior — release remains gated on installer build and packaged Electron smoke. Cost if wrong: no delivery until the gate passes.
Final: Ruling: GPU coverage — all seven models preview/animate/select offline and shared-canvas preservation tests passed after capability-gated compilation; hardware beyond this machine remains unmeasured. Cost if wrong: device-specific rendering fallback/error, no change to salary or narrative data.

Task 5 complete: 192/192 unit tests, typecheck, developer build/NSIS installer and 9/9 packaged Electron regressions passed. Package SHA-256 and UI evidence recorded in docs/verification-1.12.0.md. Existing branch retained for local delivery, no new worktree or scratch workspace created; unrelated user files left untouched.
