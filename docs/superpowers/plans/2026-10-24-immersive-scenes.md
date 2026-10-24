# Immersive page scenes implementation plan

**Goal:** Approved six distinct full-window scenes, transparent menu/cards and less decorative text; retain all functions.
**Architecture:** Add local scene backgrounds via CSS fixed layer and scoped glass tokens. Remove visible repeated page-header block, move its actual controls to sidebar. Keep screen-reader page h1. Core logic unchanged.
**Tech stack:** React, CSS, Electron, WebP, Playwright.

- [x] Inspect existing controls and generate optimized unique local page scenes.
- [x] Implement full-scene layer, glass sidebar/cards, lighter layouts, minimal functional labels.
- [x] Verify both themes and small windows, no removed operations, navigation performance and desktop transparency.
- [x] Review, package, verify installer, document and commit.
