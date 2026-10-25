---
name: testing-agent
description: Autonomous testing agent for GhostRepro Mission Control Dashboard that comprehensively tests every feature, button, and user interaction.
---

# 🧪 GhostRepro Autonomous Testing Agent

## 🎯 Role & Mission
The **Testing Agent** is an autonomous verification agent responsible for validating every feature, interactive button, form input, modal dialog, and state transition across the GhostRepro Mission Control Dashboard.

---

## 🛠️ Comprehensive Test Matrix

### 1. GitHub Account Authorization & Repository Management
- [ ] **Authorization Trigger**: Click GitHub badge in top navigation (`@username`) or "Manage Repositories".
- [ ] **Modal Verification**: Verify that the GitHub Authorization & Repositories modal opens with clean backdrop blur.
- [ ] **Username Input**: Enter target GitHub handle (e.g., `asfandkhan8585-cpu` or custom handle) and click "Authorize & Sync Repos".
- [ ] **Repo Synchronization**: Verify that repositories are retrieved from GitHub API (or fallback simulation) and rendered with stars, forks, language, open PRs, and quarantined PRs.
- [ ] **Repo Switching**: Click "Switch To" on any secondary repo (e.g. `checkout-service`). Verify the top bar dropdown and breadcrumbs immediately update to the new repository.
- [ ] **Custom Repository Addition**: Fill out "Connect New Custom Repository" form (Repo name, description, language) and click "+ Add". Verify that the repository is added to the active list and can be switched to.
- [ ] **Simulate Incoming PR**: Click "+ Simulate PR" on any connected repository. Verify a new quarantined pull request is created and appears in the Quarantine queue and Pull Requests list.

### 2. Zero-Trust Quarantine & PR Clearance
- [ ] **Quarantine Queue Inspection**: Navigate to Quarantine tab (`/Quarantine`). Verify all held PRs show author, association (`NONE`/`FIRST_TIME`), trust score, and AST delta.
- [ ] **Authorize PR**: Click "Authorize & Run Sandbox". Verify that:
  - Button switches to "Running…" state.
  - PR status flips to `PASSED`.
  - Trust score updates to 75+.
  - Pipeline stage updates to `COMPLETE`.
  - Notification toast displays pass confirmation.
  - Log item is appended to Execution Logs.
- [ ] **Reject PR**: Click "Review & reject" on an untrusted bot PR. Verify the PR status flips to `REJECTED`, pipeline stage to `BLOCKED`, and a warning log is recorded.
- [ ] **Pull Requests Table**: Verify status filters (`All statuses`, `Passed`, `Rejected`, `Quarantined`), search query filtering, and column sorting (`↕`).

### 3. Autonomous Issue-to-Test Bug Reproductions
- [ ] **Empty Space Elimination**: Verify that the Bug Reproductions tab has ZERO empty space: 4 telemetry stat cards, inline synthesizer, grid of reproduction cards, and Assertion Proof Matrix.
- [ ] **Run Sandbox Test**: Click "Run Sandbox Test" on an active issue (e.g., Issue #101). Verify that:
  - Repro status toggles between `🔴 RED (Failing Proof)` and `🟢 GREEN (Verified Fix)`.
  - Toast notification reports sandbox execution.
  - Log workstation receives sandbox test record.
- [ ] **View Pytest Code**: Click "View Pytest Code". Verify modal opens with standalone Python pytest code syntax, "Copy Code" button, and "Execute in Sandbox" button.
- [ ] **Synthesize New Bug Repro**:
  - Test modal flow via "New Bug Repro Modal" -> Enter issue # and title -> Click "Generate Repro Test".
  - Test inline flow via "Quick Repro Synthesizer" -> Enter title -> Click "Synthesize Pytest Repro".
  - Confirm newly generated test appears with initial RED status.

### 4. Slopsquatting Defense & PyPI Package Scanner
- [ ] **Threat Intelligence Radar**: Verify 4 telemetry stat cards are populated (Blocked packages, Whitelist count, Live PyPI API status, Security policy).
- [ ] **Live PyPI Scanner Tool**:
  - Enter `reqeusts` -> Click "Scan PyPI Index" -> Verify red threat banner: `🛑 Hallucinated package!`.
  - Enter `colorsys2` -> Click "Scan PyPI Index" -> Verify threat banner: `Squatted / Ghost package`.
  - Enter `requests` -> Click "Scan PyPI Index" -> Verify green authentic banner: `✅ Verified authentic PyPI package`.
  - Test quick demo chips (`reqeusts`, `colorsys2`, `requests`, `fastapi`, `numpy`).
- [ ] **Maintainer Whitelist Manager**:
  - Click "+ Add to Whitelist" on scanned package -> Verify package moves to approved whitelist.
  - Use "+ Add Package" input form to whitelist custom package.
  - Click "Dismiss" on a flagged dependency -> Verify threat is removed.

### 5. Execution Logs & Terminal Workstation
- [ ] **High-Density Terminal Display**: Verify workstation banner displays container ID, OS, Python version, pytest version, and active LLM model.
- [ ] **Run Full Sandbox Suite**: Click "Run Sandbox Suite". Verify 5 sequential execution logs are added (`SANDBOX`, `REPRO_TEST`, `FUZZING`, `MERGE_GATE`), and toast notification announces success.
- [ ] **Log Filters**:
  - Stage filters: Click `CLEARANCE`, `AST_ANALYSIS`, `REPRO_TEST`, `FUZZING`, `ALL`. Verify logs filter accurately.
  - Level filters: Click `INFO`, `WARN`, `ERROR`, `PASS`, `ALL`.
  - Search input: Type keyword and verify live regex/substring matching.
- [ ] **Copy & Export Logs**: Click "Copy All" and "Export Log File". Verify clipboard copy and file download trigger.
- [ ] **Clear Logs**: Click "Clear Logs". Verify logs reset to clean initial state.

### 6. Interactive Configuration Suite
- [ ] **Verification Rules**:
  - Drag Minimum Trust Score slider -> Verify live number updates (e.g. 85/100).
  - Toggle Auto-Quarantine switch and Strict Slopsquatting switch.
  - Change Blast Radius threshold.
  - Select Adversarial Fuzzing mutation count (32, 64, 128, 256).
  - Click "Save Verification Rules" -> Verify inline green badge "✓ Saved to maintainer policy" and toast appear.
  - Click "Reset to Defaults" -> Verify values return to baseline defaults.
- [ ] **Models & Agents**:
  - Select primary code model (`Llama-3.3-70B-Versatile (Groq LPU)`, `Llama-3.1-8B-Instant (Groq LPU)`, `Mixtral-8x7B (Groq LPU)`, `Qwen2.5-Coder 32B`).
  - Drag temperature slider (0.05 to 1.0).
  - Change context window size (16k, 32k, 64k, 128k).
  - Click "Test LLM Connection" -> Verify ping indicator and response banner `✓ Connected (~28ms) · Llama-3.3-70B-Versatile (Groq LPU)`.
  - Click "Save Model Settings" -> Verify inline green badge and toast notification.
- [ ] **Settings**:
  - Click "Copy" next to Webhook URL -> Verify copy toast.
  - Click "Ping Webhook" -> Verify HTTP 200 ping event added to pipeline feed.
  - Click "Regenerate" next to Webhook Secret -> Verify new `whsec_...` key generated.
  - Adjust Sandbox Timeout slider.
  - Click "Save Settings" -> Verify inline confirmation and toast.
  - Click "Export Config JSON" -> Verify download of `ghostrepro-config.json`.

---

## 🚀 Execution Instructions
Run this testing agent before committing any changes or tagging a release. Every single checklist item must pass with zero console errors.
