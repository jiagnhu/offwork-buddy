# 1.8.0 — 蓝橙机能主题

## Scope
Presentation-only redesign approved by user. All business state, salary calculations, calendar rules, leave handling, reminders, chat service, model assets and persistence remain unchanged.

- Shared blue/orange palette in dark and light themes; existing preference is respected.
- Local optimized city-commute hero (118638 bytes), terrace backdrop (128778 bytes), selected cat logo (7766 bytes).
- Six main pages styled to actual functionality. Calendar retains complete day dialog. Ledger retains historical calculation and detail tools. Settings retain all existing fields, backup and import.
- Static character rail on chat, hidden on narrower windows. Existing single shared Live2D preview is preserved.
- Onboarding, dialogs and controls receive matching styling.
- No runtime remote images, no extra animation library, no additional live character canvas.

## Validation
- Typecheck passed; all 159 unit tests passed.
- Six pages captured in both themes; no horizontal overflow at 1280px and 980px widths.
- Existing E2E checks passed for leave, plans, earnings details, desktop hover bubble, onboarding/settings persistence, navigation skeleton, shared canvas, chat and AI settings.
- Seven independent model nicknames and model selection checks passed after synchronizing test input with completed selection.
- Navigation timings on this machine: 14–97ms in sampled switches; no model redownload during navigation.
- Fresh source review found no important regression.
- One existing character-library startup assertion hit its five-second timeout in a suite run; standalone rerun passed without product changes. AI settings initial run omitted developer test flag; corrected run passed.
- Test chat responses used mock service, not live credentials.

## Artwork
Generated original production backgrounds using imagegen, independent of concept screenshots. Optimized WebP assets live under src/renderer/assets/theme. The chosen icon is reused for branding.

## Packaged verification
Three packaged-app E2E tests passed (59.9s): chat including restart/retry, calendar/import/dialog flows, and all six pages in both themes and two widths.
Installer: release/OffworkBuddy-Developer-Setup-1.8.0.exe
SHA256: 2930255DEC6E7DC9DE4A04E0C66AD9B34799FA7E6B196D839B4B08858ECAA468
Actual page screenshots: .cache/theme-preview/.
