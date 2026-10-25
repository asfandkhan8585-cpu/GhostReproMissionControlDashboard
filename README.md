# 🛡️ GhostRepro: Autonomous Issue-to-Test Reproduction & PR Gatekeeper

> **Zero-Trust PR Verification, Role-Based Contributor Filtering & Anti-Slop Security Powered by Groq Open-Source LPU Models (`Llama-3.3-70B`, `Llama-3.1-8B`)**
> *Built for Hacktoberfest & Open-Source Maintainers to eradicate AI-generated slop and verify code via mathematical proof.*

---

## 📌 The Crisis in Open Source
During Hacktoberfest and beyond, open-source maintainers face an unprecedented wave of AI-generated Pull Requests ("PR slop") that look plausible on the surface but are either broken, inject hallucinated packages, or bypass tests with hardcoded hacks.
- **cURL AI Spam Crisis (Daniel Stenberg)**: AI submissions flooded triage with convincing-looking fake fixes.
- **GitClear Code Quality Study (150M+ lines)**: Code churn (reverted code within 2 weeks) doubled since AI coding assistants launched.
- **KAIST (LIBRO, ICSE '23) & Google (BRT Agent, arXiv:2502.01821)**: Autonomous Bug Reproduction Tests (BRTs) cut triage time by 60%.

**GhostRepro** replaces static guesswork with **dynamic mathematical proof** powered by Groq's sub-second open-source LPU inference.

---

## 🏛️ The 4 Architectural Pillars

```
                        ┌────────────────────────────────────────────────────────┐
                        │                   GitHub Webhook Event                 │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
     [ Pillar 1: Issue Trap ]                                             [ Pillar 2: Contributor Clearance ]
     Issue Opened                                                         PR Opened
          │                                                                    │
          ▼                                                                    ▼
     Groq LPU (Llama-3.3-70B) generates                                   Role Check:
     standalone pytest repro                                              MEMBER / COLLABORATOR ──► VIP Fast-Track
     (RED: failing test proves bug)                                       FIRST_TIMER / BOT     ──► QUARANTINE Sandbox
          │                                                                    │
          └───────────────────────────────┬────────────────────────────────────┘
                                          │
                                          ▼
                         [ Pillar 3: Security & AST Gate ]
                         - PyPI Slopsquatting Scanner (blocks hallucinated packages)
                         - AST Blast-Radius (flags statement explosion & scope creep)
                                          │
                                          ▼
                         [ Pillar 4: Dynamic Gatekeeper ]
                         - Pytest Sandbox Execution (Verifies RED ──► GREEN flip)
                         - Groq Adversarial Fuzzing (kills hardcoded cheats)
                         - Auto-approves & commits permanent regression test
```

### 1. The Trap — Autonomous Issue-to-Repro
When an issue is opened, GhostRepro analyzes the codebase context and uses **Groq LPU (`llama-3.3-70b-versatile`)** to synthesize an isolated `test_repro_<id>.py`. It executes the test in an isolated runner to verify it is **RED** (failing), proving the bug is real before any PR is submitted.

### 2. Zero-Trust Clearance & Role-Based Sandboxing
- **VIP Fast-Track**: `OWNER`, `MEMBER`, `COLLABORATOR` bypass the quarantine queue with minimal latency.
- **Quarantined**: `FIRST_TIME_CONTRIBUTOR`, `NONE`, or unverified bots (`devin-ai[bot]`, `codepilot[bot]`) have their code held until authorized by a maintainer on the dashboard.

### 3. AST Blast-Radius & Anti-Slopsquatting Security Gate
- **Slopsquatting Detector**: Cross-references every imported package against the official PyPI JSON API to immediately catch AI-hallucinated or typo-squatted dependencies (e.g. `reqeusts`, `colorsys2`).
- **AST Blast Radius**: Computes AST statement delta ($\Delta$) and detects scope creep when a contributor attempts to touch unrelated files or inject dozens of unnecessary statements for a 1-line bug.

### 4. Dynamic Gatekeeper & Groq Adversarial Fuzzing
- Runs the test against the PR branch in Docker / isolated subprocess.
- Confirms the **RED $\to$ GREEN** transition.
- Synthesizes edge-case inputs via Groq LPU adversarial mutation evaluations to catch trivial cheat implementations like `if discount == 150: return 50`.

---

## 📁 Project Layout

```
GhostReproMissionControlDashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, live GitHub API routes & Webhook handlers
│   │   ├── database.py          # Dual-layer SQLite persistence engine (10 relational tables)
│   │   ├── llm_agent.py         # Groq Open-Source LPU Engine & autonomous prompts
│   │   ├── security.py          # Role clearance & live PyPI Slopsquatting scanner
│   │   ├── ast_analyzer.py      # AST Blast Radius & statement delta calculations
│   │   └── sandbox.py           # Docker/Subprocess Pytest execution runner
│   ├── demo_repo/               # Local sample repo used for testing bot workflows
│   │   ├── checkout.py
│   │   └── test_checkout.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env                     # GROQ_API_KEY, GROQ_MODEL, GROQ_BASE_URL, GITHUB_TOKEN
│
├── src/                         # Mission Control Dashboard (React 19 + TypeScript + Tailwind v4)
│   ├── api.ts                   # Centralized typed API client with zero mock fallbacks
│   ├── App.tsx                  # Dashboard interface with real-time telemetry & latency monitor
│   ├── index.css                # Dark mode styling tokens
│   └── main.tsx
├── .agents/                     # Autonomous agent workflows (testing, review, screenshot)
├── agents/                      # Companion CLI verification scripts
├── test_live_system.py          # 18-suite, 95-check live end-to-end verification test suite
├── .env                         # Root environment configuration
├── package.json
└── vite.config.ts
```

---

## 🛡️ Strict Zero-Mock Data Architecture

GhostRepro enforces a strict **Zero-Mock Policy** throughout its frontend and backend:
- **Real GitHub API Ingestion**: The "Fetch Open PRs from GitHub" action queries `https://api.github.com/repos/{owner}/{repo}/pulls` directly. If a repository has no open PRs, it reports an honest empty state or `404: No open pull requests found`—**it never fabricates fake contributors, fake PR titles, or fabricated blast radius deltas**.
- **Live Official PyPI Index**: Slopsquatting detection executes real-time queries against `https://pypi.org/pypi/{pkg}/json`. It does not rely on synthetic fallback lists.
- **Genuine LLM Telemetry**: LLM ping tests communicate live with Groq LPUs (`llama-3.3-70b-versatile`) and propagate actual network exceptions if unreachable.
- **Relational SQLite Persistence**: All maintainer authorizations, multi-repo selections, synthesized bug repros, security flags, and execution logs persist to local SQLite (`backend/data/ghostrepro.db`).

---

## ⚡ Quick Start & Environment Setup

### 1. Environment Configuration
Create or review `.env` in both the project root and `backend/.env`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
GITHUB_TOKEN=ghp_your_optional_github_token_for_higher_rate_limits
```

### 2. Run the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API runs at: `http://127.0.0.1:8000`*
*Health Check: `http://127.0.0.1:8000/api/health`*

### 3. Run the Mission Control Dashboard
```bash
npm install
npm run dev
```
*Frontend runs at: `http://localhost:8443`*

---

## 🧪 Comprehensive Live Test Suite

GhostRepro includes a full end-to-end verification suite that validates the entire live system without any mocked responses:

```bash
# Run against the active local backend (http://127.0.0.1:8000)
python test_live_system.py
```

### Test Suite Coverage (18 Suites / 95 Assertions):
1. **[1/18] Backend Health & Status**: Validates `GET /api/health` and root API endpoints.
2. **[2/18] GitHub User & Persistence**: Validates maintainer profile persistence.
3. **[3/18] Repository Management**: Tests dynamic repository additions and SQLite storage.
4. **[4/18] Repository Switching**: Verifies workspace target switching.
5. **[5/18] GitHub Repository Sync**: Validates repository synchronization.
6. **[6/18] PyPI Slopsquatting Detector**: Live network validation of real PyPI packages vs typosquats.
7. **[7/18] Threat Registry & Whitelisting**: Verifies flagging and package whitelisting.
8. **[8/18] AST Blast Radius Engine**: Computes statement deltas and verifies scope creep detection.
9. **[9/18] Autonomous Bug Repro Synthesizer**: Tests Groq LPU test synthesis into RED state.
10. **[10/18] Bug Repro Sandbox Execution**: Executes pytest in sandbox and verifies RED ──► GREEN flip.
11. **[11/18] Bug Repro Code Retrieval**: Retrieves generated pytest code assertions.
12. **[12/18] Issues & Reproductions List**: Tests issue listing and nonexistent issue 404 validation.
13. **[13/18] Real GitHub PR Querying**: Validates genuine PR fetching, empty repos, and rate limits.
14. **[14/18] Dashboard Metrics & Quarantine**: Aggregates live PR statistics and quarantine queue.
15. **[15/18] Configuration CRUD**: Updates verification rules and minimum trust thresholds.
16. **[16/18] Webhook Ping & Events**: Dispatches test webhook events.
17. **[17/18] Execution Logs & Sandbox Suite**: Validates execution logging and log clearing.
18. **[18/18] SQLite Database Physical Integrity**: Verifies all 10 schema tables and records.

---

## 🎯 3-Step Demo Pitch Flow

| Step | Action | Maintainer Dashboard View |
|------|--------|---------------------------|
| **1. Issue Reproduction** | File an issue: *"Payment retry causes double charge"* | GhostRepro generates `test_repro_279.py`. Test runs in sandbox and turns **RED** (Verified Issue). |
| **2. Quarantine & Slop Detection** | Bot `devin-ai[bot]` submits PR with hallucinated `reqeusts` & 187 statement delta | Contributor quarantined. Slopsquatting alert triggered. Maintainer reviews & rejects. |
| **3. Real Fix & Green Flip** | Verified contributor submits genuine fix | Clearance passed, AST delta $\Delta 4$, RED $\to$ GREEN confirmed, PR auto-approved. |

---

## 🔒 Security Principles
- **Zero Fabricated Data**: Always verify live external sources (GitHub REST API, PyPI JSON index) and never use optimistic mock data.
- **No Untrusted Execution**: Sandbox runner enforces ephemeral execution, time limits, and non-root execution.
- **Fail-Closed**: If PyPI is unreachable or AST parsing errors occur, contributions are quarantined rather than auto-approved.
- **Human In The Loop**: Zero-trust access control ensures maintainers maintain absolute sovereignty over their repositories.
