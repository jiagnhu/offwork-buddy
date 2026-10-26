# 1.11.0 — Built-in character cards

Approved V2 author documents compile into shared public introductions and selected-role lore. Normal chat receives current-character biography plus explicit knowledge boundaries; clicks use compact core under 2400 characters. User nickname remains display data and does not override canonical identity. Seven antagonistic/ambivalent identities preserved.

UI: read-only intro and optional spoiler-marked biography, existing actions/select/name features retained. Full biography chunk loads only on expansion (57.77 kB raw, 22.03 kB gzip), main JS remains ~299.17 kB. Reader omits internal IDs/writing rules and strips Markdown markers.

Validation: 169 unit tests and typecheck passed. 8 desktop E2E checks passed before final review fixes: profile loading, seven-name persistence, chat/retry/persistence, three bubble cases and navigation. Navigation sample 31.8–73.8 ms. Final focused UI recheck and packaged results appended below.

Independent review found CRLF determinism, author/character knowledge ambiguity and raw Markdown display issues; all fixed and re-reviewed. Added a CRLF temp-checkout regression that failed before fix and passed afterwards. Prompt tests verify knowledge qualifiers for three blackout participants.

AI tests use local mocked SSE/upstream responses; no personal API key used. They validate card selection and request behavior, not subjective live model voice. Story branches, shared world state, long-term memory and voice remain out of scope.

Final focused UI rerun passed in 23.3s after one transient startup/menu timeout (no script error in trace). Expanded dossier screenshot inspected: Rice model, custom nickname, intro, biography and existing motion controls render correctly.

Developer NSIS installer built successfully. Packaged executable smoke test (`BUDDY_EXECUTABLE=release/win-unpacked/下班搭子.exe`, `tests/character-cards.spec.ts`) passed: 1 test, 23.5s total. The test uses an isolated temporary data directory and checks profile identity, on-demand biography loading, nickname preservation and model rendering.

Artifact: `release/OffworkBuddy-Developer-Setup-1.11.0.exe`.
SHA-256: `BC20305F7983A625153A7D63340ABF0DFBEDCCC6D5BD1E87E93C92FA559B363C`.
