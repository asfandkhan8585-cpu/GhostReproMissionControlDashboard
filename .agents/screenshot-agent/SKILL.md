---
name: screenshot-agent
description: Visual verification and screenshot inspector agent that audits layout density, dark mode aesthetics, responsive styling, and validates UI changes across all dashboard views.
---

# 📸 GhostRepro Visual Verification & Screenshot Agent

## 🎯 Role & Mission
The **Screenshot Agent** is responsible for visual inspection, UI consistency verification, layout density evaluation, and ensuring that no empty or awkward blank spaces exist across any tab of the GhostRepro Mission Control Dashboard.

---

## 🎨 Visual Quality & Density Checklist

### 1. Zero Empty Space Verification
- [ ] **Overview Tab**:
  - Top meta bar displays active repo, live pulse dot, and sync action.
  - 4 distinct metric cards with sparkline SVGs, shields, and delta indicators.
  - Active pipeline workflow with 5 visual progress nodes.
  - Pipeline activity feed (Last 24h events with colored status dots).
  - Split view containing PR Scorecards table and Quarantine Access Control queue.
- [ ] **Bug Reproductions Tab**:
  - 4 high-impact metric cards across the top (Active RED, Verified GREEN, Accuracy, Model).
  - Prominent suite header with "Trigger New Bug Repro Test" button.
  - Inline Quick Repro Synthesizer panel filling vertical space.
  - Multi-column grid of bug reproduction cards with RED/GREEN status chips and code badges.
  - Autonomous Pytest Assertion Proof Matrix table.
- [ ] **Slopsquatting Threat Intel Tab**:
  - 4 telemetry cards (Blocked packages, Whitelist count, Live PyPI API status, Security policy).
  - Full-width Live PyPI Package Scanner Tool with input, quick demo chips, and scan verdict banner.
  - Currently Blocked AI-Hallucinated Dependencies table with actions.
  - Maintainer Pre-Approved Whitelist chip container with add-package form.
- [ ] **Execution Logs Tab**:
  - High-density terminal workstation header with container metadata and action buttons.
  - Filter toolbar with stage chips, level chips, and live search bar.
  - Full-screen color-coded monospace terminal console with blinking prompt.
- [ ] **Configuration Suite Tabs (Verification Rules, Models & Agents, Settings)**:
  - Form containers are properly centered or max-width aligned (840px).
  - Sliders have accompanying numerical readouts.
  - Switches have clear toggle tracks and smooth animations.
  - Save buttons feature checkmark icons and inline visual feedback.

### 2. Design Tokens & Color Harmony
- [ ] **Dark Backgrounds**: Consistent use of `#101514`, `#121a16`, `#141c18` dark surfaces.
- [ ] **Accent Colors**:
  - Green (`#8edaa1`, `#3fb950`): Verified tests, passed PRs, legitimate packages.
  - Red (`#ff8a80`, `#c55850`): Active bug reproductions (RED proofs), blocked slop PRs, hallucinated packages.
  - Amber (`#f1cf81`, `#e3b341`): Quarantined pull requests, suspicious packages, warnings.
  - Blue (`#82c2ff`): Model telemetry, informational chips, active repository indicators.
- [ ] **Typography**:
  - Body: `DM Sans` for clean, modern readability.
  - Telemetry & Code: `IBM Plex Mono` for timestamps, statement deltas, package names, and pytest files.

### 3. Modal & Drawer Overlay Verification
- [ ] **GitHub Authorization Modal**:
  - Backdrop blur overlay (`rgba(4, 8, 6, 0.75)`).
  - Authenticated maintainer avatar card with green badge.
  - Form input fields with focus ring highlights.
  - Scrollable repository list with clear "Switch To" and "Simulate PR" buttons.
- [ ] **Code Viewer Drawer**:
  - Dark monospaced code window with copy button and run button.
- [ ] **Notifications Popover**:
  - Compact dialog with recent activity items and timestamps.

---

## 📷 Automated Screenshot & Visual Regression Protocol
When a browser environment is connected:
1. Navigate through each tab: `/Overview`, `/Pull requests`, `/Quarantine`, `/Bug reproductions`, `/Slopsquatting`, `/Execution logs`, `/AST analysis`, `/Verification rules`, `/Models & agents`, `/Settings`.
2. Capture full-page viewport screenshots (`1920x1080` and `1280x800`).
3. Compute visual diffs to guarantee no unexpected layout shifts or clipped elements.
4. Verify that dark mode aesthetic meets the high-end NSTP Hacktoberfest mission control aesthetic standard.
