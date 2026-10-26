# Built-in character cards implementation plan

**Goal:** Ship the approved seven V2 personas, read-only introductions, and shared chat/click identity without user configuration.
**Architecture:** Compile approved author Markdown into deterministic public profiles and full per-character lore JSON. Public profiles feed UI and compact click prompts; the server alone selects chat lore by validated character ID. Full UI biographies load on explicit expansion. Preserve nickname and history APIs.
**Tech Stack:** Electron, React, TypeScript, esbuild/Vite, Vitest/Playwright.
**Spec:** docs/characters-v2/README.md and 08-interaction-and-continuity.md.

- [x] Add failing prompt tests for seven identities, canonical responsibility, nickname-as-data, and compact interaction requests.
- [x] Add deterministic card compiler with validation; run before application/service builds. Keep generated assets reproducible and checked in for tests.
- [x] Extract server prompt builder with common reality rules, public character core, current-character biography and concise shared context; no cross-character private biographies.
- [x] Replace old public copy; add read-only introduction and optional lazy biography within existing preview, preserving model actions/select/name flows.
- [x] Validate unit/type checks, desktop profile/nickname/click/navigation regressions. Independently review the implementation and address findings.
- [x] Build developer installer, smoke-test packaged entry, record limitations (mock AI tests cannot prove subjective voice), commit scoped changes.

Out of scope: persistent long-term memory, shared story branches, voice, new motion resources. Never clear existing chat history or send real user credentials in tests.

Rulings: Full biography is provided only for the selected normal-chat role; click receives compact core. Reader UI omits writing rules/IDs and lazily loads narrative sections. Author-view knowledge is constrained by explicit per-role boundary notes. No persistent story-state or long-term memory implied.
