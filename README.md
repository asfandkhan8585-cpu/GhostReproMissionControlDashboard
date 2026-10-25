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

## 🚀 Project Layout

```
GhostReproMissionControlDashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS middleware & Webhook routes
│   │   ├── llm_agent.py         # Groq Open-Source LPU Engine & Prompts
│   │   ├── security.py          # Role-based user filter & PyPI Slopsquatting scanner
│   │   ├── ast_analyzer.py      # AST Blast Radius & complexity delta calculations
│   │   └── sandbox.py           # Docker/Subprocess Pytest execution runner
│   ├── demo_repo/               # Local sample repo used for testing bot workflows
│   │   ├── checkout.py
│   │   └── test_checkout.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env                     # GROQ_API_KEY, GROQ_MODEL, GROQ_BASE_URL
│
├── src/                         # Mission Control Dashboard (React + TypeScript + Tailwind v4)
│   ├── api.ts                   # Centralized typed API client + Direct Groq LPU fallback
│   ├── App.tsx                  # Dashboard interface with real-time telemetry & latency monitor
│   ├── index.css                # Dark mode styling tokens
│   └── main.tsx
├── .env                         # Root environment configuration
├── package.json
└── vite.config.ts
```

---

## ⚡ Quick Start & Environment Setup

### 1. Environment Configuration
Create or review `.env` in both the project root and `backend/.env`:
```env
GROQ_API_KEY=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
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

### 2. Run the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API runs at: `http://127.0.0.1:8000`*

### 3. Run the Mission Control Dashboard
```bash
npm install
npm run dev
```
*Frontend runs at: `http://localhost:8443`*

---

## 🎯 3-Step Demo Pitch Flow

| Step | Action | Maintainer Dashboard View |
|------|--------|---------------------------|
| **1. Issue Reproduction** | File an issue: *"Payment retry causes double charge"* | GhostRepro generates `test_repro_279.py`. Test runs in sandbox and turns **RED** (Verified Issue). |
| **2. Quarantine & Slop Detection** | Bot `devin-ai[bot]` submits PR with hallucinated `reqeusts` & 187 statement delta | Contributor quarantined. Slopsquatting alert triggered. Maintainer reviews & rejects. |
| **3. Real Fix & Green Flip** | Verified contributor submits genuine fix | Clearance passed, AST delta $\Delta 4$, RED $\to$ GREEN confirmed, PR auto-approved. |

---

## 🔒 Security Principles
- **No Untrusted Execution**: Sandbox runner enforces ephemeral execution, time limits, and non-root execution.
- **Fail-Closed**: If PyPI is unreachable or AST parsing errors occur, contributions are quarantined rather than auto-approved.
- **Human In The Loop**: Zero-trust access control ensures maintainers maintain absolute sovereignty over their repositories.
