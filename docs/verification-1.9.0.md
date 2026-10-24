# 1.9.0 — 整页场景与透明界面

## Scope
User-approved immersive scene treatment for all six pages, with transparent navigation and cards. Visible repeated page-header module removed; its theme switch and desktop-mode controls moved to sidebar. An offscreen page heading remains for accessibility.

- Overview: riverside clock-out cat; calendar: planning desk; ledger: night office; character space: terrace; chat: evening lounge; settings: organized tech workspace.
- Six local optimized WebP scenes total 1,197,058 bytes. No remote image requests or new animation libraries.
- Dark cards use 52% navy fill with 4px blur; sidebar uses32% fill and2px blur. Light theme uses stronger white fill for readable dark text.
- Removed decorative slogans; retained salary assumptions, holiday status, error messages, privacy disclosures and backup/import instructions.
- Dialogs remain opaque and scoped scene CSS does not affect standalone desktop windows.
- Business calculations, calendar/leave/plan handlers, model loading and chat logic unchanged.

## Verification
Typecheck and159 unit tests passed. Both themes/sixpages verified at1280x900 and980x760 without horizontal overflow. Distinct scene perpage and relocated controls asserted.
Navigation sample32.5–73ms, no model download during page switches.
Independent review found no functional regression; screenshots inspected and dark selected-nav specificity corrected.

Final regression and packaged checks recorded after completion.
Final development regression: 11 desktop E2E tests passed in 2.4min, including AI settings, chat, hover bubbles, earnings, calendar/import, leave, shared model, visual six-page sweep and setup/persistence.

Packaged app: 2 E2E checks passed in38.6s (six-page theme/width sweep and calendar/import/dialog flows).
Installer: release/OffworkBuddy-Developer-Setup-1.9.0.exe
SHA256: C3E9D0CF13F3DC5F8D23474B7966C471F3A0F135558495625CBB2C626EDA5B33
