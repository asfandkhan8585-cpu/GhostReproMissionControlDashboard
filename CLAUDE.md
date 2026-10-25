# 🛡️ GhostRepro Mission Control — Developer & Agent Guide (CLAUDE.md)

Welcome to **GhostRepro**, an autonomous issue-to-test reproduction framework and zero-trust pull request gatekeeper built for Hacktoberfest and open-source maintainers. GhostRepro combines AST blast-radius analysis, PyPI slopsquatting detection, sandboxed pytest execution, and Qwen-2.5-Coder adversarial fuzzing to mathematically verify contributions and stop AI-generated PR slop.

---

## 🏛️ System Architecture

GhostRepro operates across 4 core security pillars:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GitHub Webhook Event / User Action              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
[ Pillar 1: Issue Trap ]                                [ Pillar 2: Clearance ]
Issue Opened                                            PR Opened
  │                                                       │
  ▼                                                       ▼
Qwen-2.5-Coder generates                                Role Check:
standalone pytest repro                                 OWNER / MEMBER / COLLAB ──► VIP Fast-Track
(RED: failing test proves bug)                          FIRST_TIMER / BOT       ──► QUARANTINE Sandbox
        │                                                       │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                   [ Pillar 3: Security & AST Gate ]
                   - PyPI Slopsquatting Scanner (blocks hallucinated packages)
                   - AST Blast-Radius (flags statement explosion & scope creep)
                                    │
                                    ▼
                   [ Pillar 4: Dynamic Gatekeeper ]
                   - Pytest Sandbox Execution (Verifies RED ──► GREEN flip)
                   - Qwen Adversarial Fuzzing (128 mutations kill hardcoded cheats)
                   - Auto-approves & commits permanent regression test
```

---

## 💻 Tech Stack

### Frontend Mission Control Dashboard
- **Framework**: React 19 + TypeScript 5.7 + Vite 8
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` + Custom Design System tokens (`src/index.css`)
- **Typography**: `DM Sans` (UI / headings) + `IBM Plex Mono` (Telemetry / code / logs)
- **State & Telemetry**: Typed centralized client (`src/api.ts`) with live FastAPI integration, public GitHub API queries, PyPI JSON index lookups, and persistent local storage fallback.

### Backend Orchestrator & Runner
- **API Server**: FastAPI + Pydantic v2 + Uvicorn
- **AST Engine**: Python `ast` module parsing statement deltas and scope creep (`backend/app/ast_analyzer.py`)
- **Security Scanner**: PyPI official JSON API lookup + role clearance (`backend/app/security.py`)
- **LLM Engine**: Groq Cloud Open-Source LPUs running `llama-3.3-70b-versatile` (<40ms latency) with deterministic sampling for autonomous pytest synthesis and 128 adversarial mutations.

---

## 🚀 Running the Project

### 1. Frontend Development Server
The Vite server is pre-configured to run with hot module replacement (default port: 8443 or 5173):
```bash
npm run dev
# or with pnpm
pnpm dev
```
Preview URL: Open the IDE preview tab or navigate to `http://localhost:8443` in your browser.

### 2. Backend Orchestrator
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Health Check: `http://localhost:8000/api/health`

---

## 📁 Repository Layout

```
GhostReproMissionControlDashboard/
├── .agents/                      # Autonomous agent skills & configurations
│   ├── testing-agent/SKILL.md    # Autonomous button & feature testing agent
│   ├── review-agent/SKILL.md     # Zero-context adversarial reviewer
│   └── screenshot-agent/SKILL.md # Visual verification & density inspector
├── agents/                       # Companion CLI agent scripts & checklists
│   ├── testing_agent/
│   ├── review_agent/
│   └── screenshot_agent/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI orchestrator, endpoints & state
│   │   ├── llm_agent.py          # Groq open-source LPU runner & robust system prompts
│   │   ├── security.py           # Role clearance & PyPI slopsquatting scanner
│   │   ├── ast_analyzer.py       # AST statement delta & scope creep detection
│   │   └── sandbox.py            # Docker/Subprocess Pytest execution runner
│   ├── demo_repo/                # Sample repository used for live test verification
│   │   ├── checkout.py
│   │   └── test_checkout.py
│   ├── Dockerfile
│   └── requirements.txt
├── src/
│   ├── api.ts                    # Centralized resilient API client & local state store
│   ├── App.tsx                   # Main Mission Control Dashboard component
│   ├── index.css                 # Dark mode design tokens & utility classes
│   ├── main.tsx                  # React DOM mount entrypoint
│   └── theme.css                 # Supplemental theme rules
├── CLAUDE.md                     # This developer & agent guide
├── CONTRIBUTING.md               # Contributor handbook & security gates
├── README.md                     # Architectural overview & project manifesto
├── package.json                  # Frontend dependencies and scripts
└── vite.config.ts                # Vite 8 + React + Tailwind v4 configuration
```

---

## 🤖 Specialized Autonomous Agents

This repository is equipped with 3 specialized agents located in `.agents/` and `agents/`:

1. **Testing Agent (`testing-agent`)**:
   - Executes end-to-end verification of all interactive controls.
   - Tests GitHub account authorization, multi-repo switching, incoming PR simulation, and custom repo additions.
   - Verifies RED/GREEN bug reproduction flips, PyPI scanner results, workstation log filters, and configuration saves.

2. **Review Agent (`review-agent`)**:
   - Operates with **ZERO prior context** about the software.
   - Evaluates code changes, diffs, and security boundaries strictly from first principles.
   - Audits button handlers, AST statement delta ($\Delta$), hallucinated packages, and error boundaries.

3. **Screenshot & Visual Agent (`screenshot-agent`)**:
   - Inspects UI presentation, layout density, and theme consistency.
   - Enforces **ZERO EMPTY SPACE** across all dashboard tabs (Bug reproductions, Slopsquatting, Execution logs, Configuration).
   - Validates responsive styling and dark mode contrast ratios.

---

## 🛠️ Key UI Features & Workflows

### 1. GitHub Account Authorization & Interactive Repositories
- Click the GitHub badge in the top navigation or "Manage Repositories".
- Enter your GitHub handle (or personal access token for private repos).
- All connected repositories are synchronized and visible in the modal.
- Maintainers can:
  - **Switch Active Repo**: Re-targets the entire mission control workspace.
  - **Fetch Open PRs**: Queries real open pull requests from the GitHub REST API for that repository.
  - **Connect Custom Repo**: Adds any custom repository directly to the dashboard.

### 2. Autonomous Bug Reproductions (RED ──► GREEN)
- Located on the **Bug reproductions** tab.
- Synthesizes standalone pytest test cases (`test_repro_<id>.py`) for incoming issues.
- Click **"Run Sandbox Test"** to execute the test and watch status flip between RED (proof of bug) and GREEN (verified fix).
- Click **"View Pytest Code"** to inspect or copy the autonomous pytest assertion code.

### 3. PyPI Slopsquatting Defense
- Located on the **Slopsquatting** tab.
- Interactive scanner tests package names in real-time against the official PyPI index.
- Automatically flags hallucinated dependencies (e.g. `reqeusts`) or placeholder squatting (e.g. `colorsys2`).
- Maintainers can approve packages into the whitelist or dismiss threat flags.

### 4. Interactive Configuration Suite
- **Verification Rules**: Adjust minimum trust scores, toggle first-time bot quarantine, set blast-radius thresholds, and save rules with instant feedback.
- **Models & Agents**: Select primary LLM (Qwen2.5-Coder 32B, DeepSeek, Claude 3.7 Sonnet, GPT-4o), set endpoints, ping connection with live latency measurement, and save settings.
- **Settings**: Copy and ping webhook endpoints, regenerate webhook secrets, adjust sandbox timeouts, and export full config JSON.

---

## 🧪 Live System Verification Suite

Run the comprehensive 18-suite, 95-check live end-to-end verification suite against the running local backend (`http://127.0.0.1:8000`):

```bash
python test_live_system.py
```

All 95 assertions test live HTTP routes, real GitHub PR querying, real PyPI package status, AST statement delta math, Groq LPU test generation, and SQLite relational integrity without any mock data assertions.

---

## 🛡️ Coding Standards & Strict Zero-Mock Guidelines
- **Strict Zero-Mock Data Rule**: The software must **never ever** use mock or fabricated data in place of real API responses. If a repository has no open PRs or a network call fails, report the genuine state honestly (fail-closed) rather than generating synthetic items.
- **Zero Empty Space**: Never leave blank or collapsed panels. Provide rich telemetry, actionable widgets, and responsive empty-state cards.
- **Always Provide Feedback**: Every interactive button must trigger user feedback (toast notification, inline badge, or state update).
- **Graceful Fail-Closed Responses**: When an external network or backend service returns an error, the UI must show the exact error message and detail rather than concealing it.
- **Preserve Types**: Use TypeScript interfaces defined in `src/api.ts` for all data structures.
