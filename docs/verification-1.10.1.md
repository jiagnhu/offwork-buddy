# 1.10.1 — Desktop topmost recovery

Desktop windows previously used floating level with no recurring z-order recovery. Added ordered nonactivating recovery every 1500 ms while desktop is visible and always-on-top preference enabled. Character/card precede input/reply; hidden/minimized/destroyed windows are never raised. Show/restore also recover. Timer cleared on quit. Existing opt-out preference preserved.

Validation: typecheck, dedicated unit test, four Electron E2E checks passed (topmost recovery, focus preservation, hidden windows, all existing AI bubble hover/priority tests). Test simulates loss of topmost state; not an exhaustive check against every external app or exclusive fullscreen/system secure desktop.
