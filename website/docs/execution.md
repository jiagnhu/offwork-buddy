# Execution ledger — 2026-10-22-website

Plan: docs/superpowers/plans/2026-10-22-website.md

Ruling: Reuse the current codex branch and isolate all edits in website/ as the user requested direct execution of this independent directory. Other desktop edits are present and must not be staged or changed. Cost: website commits share the parent's branch until the website is moved out.

Ruling: Use this portable ledger and native Node/PowerShell instead of the skill's Unix bookkeeping wrappers on Windows. Cost: progress is recorded manually.

Pre-flight: tasks 1 and 3 share detectPlatform/recommendDownload; tasks 2 and 3 share releases.json and validated download URL. The server and build will supply the same release data contract.

Task 1: complete — 13 platform/selection tests pass after missing-module RED.
Task 2: local download complete — streaming HTTP verification passed for actual 115094734-byte installer and SHA-256. HTML/size/hash/404 test passed after missing-module RED.
Ruling: Node 20 on Windows does not expand the test glob; use node --test tests. Cost: none; tests are discovered portably.
Ruling: Ship installer as verified static 20 MiB parts, reconstructed in the browser, so deployment needs no new storage account or backend. Cost: download requires JavaScript and approximately 350 MiB free browser memory; user receives the original .exe. Direct HTTPS download configuration remains supported.
Task 3: complete first implementation — responsive page, two character previews, platform selector and download state implemented. Browser inspection found JSX stopColor attributes were invalid in standalone SVG; converted to stop-color.

Task 3: browser verified desktop, mobile, character switching, platform selection and real 110 MiB browser download. Fixed rotated-cat mobile overflow; final scrollWidth equals clientWidth.
Final: fixed frozen Windows UA false architecture inference — regression RED→GREEN.
Final: fixed switching back to automatic mode — delayed ARM regression RED→GREEN; full suite 17/17.
Final review: independent reviewer completed; two important findings fixed, no deferred minors.
Task 4: first deployment succeeded at https://offwork-buddy-home.tyk-kyt.chatgpt.site; same-site final correction deployment in progress. No access changes requested or made.
