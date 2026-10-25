# 🧪 Agent 1: Testing Agent

## Purpose
The **Testing Agent** performs autonomous behavioral, integration, and UI testing across all views of GhostRepro Mission Control. It ensures that every interactive button, input field, modal dialog, and network simulation operates without error and remains fully consistent with the FastAPI backend.

## Coverage Checklist
1. **GitHub Authorization & Multi-Repo Manager**:
   - Tests authorization modal, PAT & username input, live repository retrieval.
   - Tests switching active repository and verifying UI-wide updates.
   - Tests creating custom repositories.
   - Tests simulating incoming pull requests for any repo.
2. **PR Gatekeeper & Quarantine Review**:
   - Tests human maintainer authorization (`Authorize & Run Sandbox`) flipping PR status to PASSED and boosting trust score.
   - Tests maintainer rejection (`Review & reject`) blocking the contribution.
   - Tests sorting and status filtering on the PR scorecards table.
3. **Autonomous Bug Reproductions**:
   - Tests telemetry statistics cards (Active RED, Verified GREEN, Accuracy, Model).
   - Tests "Run Sandbox Test" flipping RED failing tests to GREEN verified fixes.
   - Tests "View Pytest Code" drawer.
   - Tests both modal and inline issue-to-repro synthesis.
4. **Slopsquatting & Dependency Intelligence**:
   - Tests real-time PyPI scanner against hallucinated, typosquatted, and authentic packages.
   - Tests adding packages to the maintainer whitelist.
   - Tests dismissing threat flags.
5. **Execution Logs Workstation**:
   - Tests live streaming logs, filtering by stage and level, searching with regex.
   - Tests running the full 128-mutation sandbox suite.
   - Tests clearing console logs and exporting log files.
6. **Configuration Suite**:
   - Tests saving Verification Rules, Models & Agents, and Repository Settings.
   - Tests LLM ping test and Webhook delivery ping.
   - Tests resetting to defaults and exporting JSON configuration.
