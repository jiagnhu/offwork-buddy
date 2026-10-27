# Natural character dialogue

Approved direction: direct, conversational replies; seven distinct personalities; ordinary introductions do not reveal or advertise plot secrets. Preserve complete biographies, story choices, memory, nicknames and desktop interactions.

## Design and interfaces

Curate `src/server/character-dialogue.ts` from the existing V2 author cards: public identity/voice, daily details and ordinary background. Keep secret-bearing author biographies out of runtime system prompts. The complete dossier remains in Character Space. This small runtime projection is manually reviewed against `docs/characters-v2`; it adds no new canon.

Keep `buildCharacterPrompt(kind, name, purpose, context)` and request/storage schemas unchanged. Existing `storyContext` remains the sole source of scene/evidence disclosure; ordinary background is offered when relevant or asked about, never unlocked by a message-count score. Active story allows scene-oriented conversation; paused stories stay background. Past assistant assertions, user guesses and user memories do not unlock canonical facts.

Default direct short conversational replies, with depth for questions that need it. No canned replacement outputs, automatic question endings, quoted introductions, meta-writing commentary or cliffhangers. Preserve honest AI identity when asked and existing safety/memory receipt behavior.

## Task 1: Runtime projection and regression coverage

- [x] Replace tests requiring full biography injection with seven-role secret-exclusion/public-trait assertions; retain nickname/click/memory/intent contracts. Watch failures.
- [x] Add curated dialogue cards and update prompt assembly. Include relevant ordinary background only as optional conversational material; clicks receive identity/voice/daily details only.
- [x] Exercise real story-engine disclosure before/after evidence sharing and paused states; service forwarding must preserve request schemas and budgets.
- [x] Run targeted tests, full unit suite and typecheck. Commit implementation.

Verification: `npm test` and `npm run typecheck`.

## Task 2: Live acceptance and local release

- [x] Run synthetic live conversations through the existing encrypted local AI configuration; do not read user chat or log credentials. Inspect all seven introductions, repeated Miara introductions, ordinary follow-ups, practical help, secret bait, active/paused story, memory and clicks.
- [x] Adjust wording if live output reveals a defect, record sampled outputs/limits. Do not claim deterministic guarantees from live samples.
- [x] Bump patch to 1.12.1, build developer installer and test packaged chat/story/character cards. Record results and installer checksum.
- [x] One fresh-context read-only final review, address substantive findings with regression tests, commit and deliver locally without auto-installing or publishing.

## Review Focus

Check secret leaks through public/core/background fields or negative examples; accidental loss of seven distinct moral positions; omniscience across actors/worlds; overly restrictive prompts blocking technical help or author-dossier access; stale assistant lore overriding saved evidence; regression in nickname, memory/intent and click limits. Evaluate whether live replies actually sound direct and avoid unprompted mystery bait; tests of prompt text alone do not prove language quality.
