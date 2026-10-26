# QA repair report — partial delivery

Branch: `fix/qa-and-ui-overhaul`. Existing uncommitted user changes were preserved and are included in the working tree.

## Verified fixes

Backend regression tests cover mutation authentication, unauthorized bootstrap, unsigned webhooks, malformed LLM verdicts, honest mutation counts, missing merge evidence, changed PR heads, and repository-specific code lookup. All eight pass; baseline six demo tests remain passing. Frontend four tests pass. Production build and TypeScript have passed after style extraction.

Configured Groq model was unavailable; the connection check used and honestly reported `qwen/qwen3.8-27b`. The provided key is only in ignored `.env` and was used for a successful live request. No credential values are included in this report.

## UI work

388 static inline style objects extracted into classes; component hex colors centralized in CSS variables; tiny static font sizes raised to 12px; simulation warning, focus, table scrolling and tablet refinements. Dynamic inline styles remain. Before/after screenshots and axe output are under `docs/ui-changes`.

Baseline JS: 349.74 kB (gzip 100.29); after extraction: 332.43 kB (gzip 98.08). CSS grew from 31.68 kB (gzip 6.65) to 64.19 kB (gzip 11.97). This is style relocation, not a total bundle-size improvement. Runtime dependencies remain 2; development dependencies grew from 10 to 16 for testing.

## Outstanding release gates

Full endpoint matrix, all checklist click-throughs, keyboard/focus/dialog audits, supported-repository compatibility, successful SHA evidence production, permissions/upstream failure coverage for every endpoint, complete persistence restart tests, full secret-tree audit, and visual inspection of every screenshot are outstanding. Existing default/fallback metadata and rejection paths require further auditing. The Windows subprocess has no OS resource isolation. Existing dependency deprecation warnings remain.

Vulture ran and found candidates; no files or dependencies were removed because usage/removal proof has not been completed. Knip was launched; its result must be reviewed. No broad architecture split was performed.

Do not push or open a release PR until the original final verification gates pass. No claim is made that all repository types work.

Final browser audit executed: four serious violation groups found (contrast in scanner/logs/Studio and an unnamed Studio select). Targeted corrections applied; rerun result must be consulted before claiming accessibility passes. Knip found unused jest-dom dependency and five exported symbols; no removal performed.
