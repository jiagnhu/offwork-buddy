# Blue Orange Offwork Theme Implementation Plan

**Goal:** Apply the approved city-sunset streetwear theme while preserving all functions, persisted preferences and business rules.
**Architecture:** Keep handlers and data models unchanged. Add local illustrated assets and a final theme stylesheet, small presentational page wrappers and a static chat companion rail. Preserve shared Live2D provider, lazy routes and skeleton navigation.
**Tech Stack:** Electron, React, TypeScript, CSS, Vite, Playwright.

- [x] Generate independent city commute and terrace artwork; export optimized local WebP and add selected logo.
- [x] Update semantic palette for light/dark, sidebar, headers, cards, forms, tables and dialogs; retain preference selection.
- [x] Adapt overview, calendar, ledger, character space, chat and settings to existing controls. No mock data, no removed controls, no new business logic.
- [x] Verify typecheck, unit tests and relevant desktop flows; capture all six pages in both themes and inspect overflow and contrast.
- [x] Build installer, review changes, document verification and commit.

Approved direction: dark navy/electric blue/orange, city sunset header artwork, terrace character backdrop, clean data surfaces. Retain calendar day modal and ledger export/recalculation. No new sound, account or chart features implied by concept images.
