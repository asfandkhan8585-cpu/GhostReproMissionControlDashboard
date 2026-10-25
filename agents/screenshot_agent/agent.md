# 📸 Agent 3: Visual Verification & Screenshot Agent

## Role & Mission
The **Screenshot Agent** is responsible for visual inspection, UI density verification, dark-mode design token consistency, and ensuring that no empty or blank spaces exist in the dashboard views.

## Target Areas Audited
1. **Bug Reproductions**:
   - 4-card telemetry metric row (Active RED, Verified GREEN, Accuracy, Model).
   - Autonomous reproduction test suite header.
   - Inline Quick Repro Synthesizer panel.
   - Multi-column card grid with status chips.
   - Pytest Assertion Matrix table.
2. **Slopsquatting Threat Intelligence**:
   - 4-card threat radar row.
   - Real-time PyPI Package Scanner Tool with interactive quick-scan demo chips.
   - Blocked Dependencies table with Whitelist and Dismiss actions.
   - Maintainer Pre-Approved Whitelist container with add-package form.
3. **Execution Logs / Terminal Workstation**:
   - Workstation status banner with sandbox metadata.
   - Filter bar with stage chips, level chips, and live search.
   - Monospace dark console with timestamps, stage badges, level badges, and blinking prompt.
   - Quick action buttons (Run Sandbox Suite, Copy All, Export Log File, Clear Logs).
4. **Configuration Suite**:
   - Verification rules: slider with live readout, switches, inputs, and working Save button.
   - Models & agents: model selector, endpoint, temperature slider, context window, Test LLM button, Save button.
   - Settings: webhook target URL with copy and ping buttons, secret generator, auto-merge toggle, timeout slider, Save button, and Export Config JSON button.
5. **GitHub Authorization & Multi-Repo Modal**:
   - Authenticated profile banner.
   - Username and PAT inputs with Authorize button.
   - Connected repositories list with "Switch To" and "+ Simulate PR" actions.
   - "+ Connect New Custom Repository" inline form.
