# GhostRepro QA checklist

Statuses describe executed evidence, never intended coverage. Test fixtures must remain in tests.

| Feature | How to test | Expected result | Status |
|---|---|---|---|
| GitHub authorize username/token | Fake GitHub profile, invalid identity, upstream timeout | Verified identity only; failure preserves state | Not verified — full endpoint/browser matrix remains outstanding |
| Repo list/select/add/sync | Valid and missing repos, upstream failure, restart | Accurate list; invalid selection preserves active repo | Not verified — full endpoint/browser matrix remains outstanding |
| PR intake and webhook | Signed payloads, malformed JSON, missing fields | Real intake; invalid requests rejected | Not verified — full endpoint/browser matrix remains outstanding |
| Clearance tiers/quarantine | Owner, contributor, unknown author | Correct clearance without fabricated trust | Not verified — full endpoint/browser matrix remains outstanding |
| Authorize/reject/merge | Denied caller, failed checks, changed head, GitHub failure | No bypass; exact verified SHA required | Not verified — full endpoint/browser matrix remains outstanding |
| Reproduction create/code/run | Stored code; pytest exits 0, 1, 2; duplicate issue numbers across repos | GREEN/RED only from execution; errors preserve state | Not verified — full endpoint/browser matrix remains outstanding |
| Single dependency scan | PyPI 200/404/429/500/timeout | Hallucinated only on 404; honest errors | Not verified — full endpoint/browser matrix remains outstanding |
| Auto-scan dependencies | Requirements files, extras, markers, comments | Only valid requirement names scanned | Not verified — full endpoint/browser matrix remains outstanding |
| Flags/whitelist/delete | Add, clear, delete, restart | State persists and empty lists clear UI | Not verified — full endpoint/browser matrix remains outstanding |
| AST/dependency analysis | Statements, async functions, invalid Python | Accurate counts; syntax errors explicit | Not verified — full endpoint/browser matrix remains outstanding |
| Sandbox suite | Existing/missing test, timeout | Actual pytest output; missing file 404 | Not verified — full endpoint/browser matrix remains outstanding |
| Adversarial review | Valid, rejected, malformed verdict, upstream timeout | LLM review honestly labeled; malformed fails closed | Not verified — full endpoint/browser matrix remains outstanding |
| Settings rules/model | Save/restart; edit across refresh | Values persist; drafts survive polling | Not verified — full endpoint/browser matrix remains outstanding |
| Test LLM | Fake Groq success/error | Actual model and error reported | Not verified — full endpoint/browser matrix remains outstanding |
| Webhook ping | Real signed request to test server | Actual response recorded | Not verified — full endpoint/browser matrix remains outstanding |
| Metrics/events/logs | Perform operations, clear logs, restart | Derived counts and persisted events | Not verified — full endpoint/browser matrix remains outstanding |
| Reset | Authorized reset and denied request | Documented state cleared; unauthorized unchanged | Not verified — full endpoint/browser matrix remains outstanding |
| Live Agent Studio | Playback all stages | Simulation labeled; no live telemetry changes | Not verified — full endpoint/browser matrix remains outstanding |
| Keyboard/accessibility | Tab controls, Escape dialogs, axe | Logical focus; no serious violations | Not verified — full endpoint/browser matrix remains outstanding |
| Main views/tablet | Playwright screenshots before/after | Readable, unclipped responsive UI | Not verified — full endpoint/browser matrix remains outstanding |

## Baseline (2026-10-26)

- Existing dirty worktree: five source files already modified; preserved.
- Requested branch created: `fix/qa-and-ui-overhaul`.
- `npm run build`: PASS, Vite 8.3.5; JS 349.74 kB (gzip 100.29 kB), CSS 31.68 kB (gzip 6.65 kB).
- `npx tsc --noEmit`: PASS.
- `python -m pytest -q`: could not run initially: Python absent from PATH. Runtime subsequently located through uv; setup underway.
- Frontend baseline: 2 runtime dependencies, 10 development dependencies; no frontend test scripts.
- Only `src/index.css` exists. Referenced `theme.css` is absent; no deletion needed.
- Supplied credential has not been written to the project.

## Executed evidence

- Baseline backend: 6 demo tests passed.
- Repair regression run: 14 tests passed (8 integrity + 6 demo); 7 dependency deprecation warnings.
- Frontend: 4 tests passed (API failures/credentials and Studio simulation labeling).
- Before screenshots: 8 URL-selected views captured; not proof that every named route maps to an existing tab.
- Live Groq request with the supplied ignored `.env` credential: connected; reported actual fallback model `qwen/qwen3.8-27b`, latency 663 ms. No GitHub write action was performed.
- Authentication, malformed verdict, missing verification, changed head, and repository-code lookup are covered in `backend/tests/test_integrity.py`; complete happy-path coverage remains outstanding.
