# 🤝 Contributing to GhostRepro

Thank you for your interest in contributing to **GhostRepro**! GhostRepro is built for Hacktoberfest and the open-source community to eradicate AI-generated slop, protect repositories from hallucinated packages, and verify pull requests through mathematical proof.

Because GhostRepro is itself an autonomous zero-trust gatekeeper, we hold all contributions to the highest standard of mathematical and structural verification.

---

## 🏛️ The 4 Verification Pillars Every PR Must Pass

Before your pull request can be merged into `main`, it will be evaluated autonomously by GhostRepro against 4 security pillars:

### 1. Zero-Trust Contributor Clearance
- **Maintainers / Collaborators**: Automatically fast-tracked through the clearance gate.
- **First-Time Contributors & AI Bot Personas**: Held in the Quarantine Sandbox until reviewed and authorized by a maintainer via the Mission Control Dashboard.
- **Tip**: Make sure your git commit email matches your verified GitHub profile.

### 2. PyPI Anti-Slopsquatting Security Gate
- Every dependency added to `requirements.txt`, `package.json`, or imported in code is scanned against official package registries (e.g. PyPI JSON API).
- Any package that does not exist on official indices (AI hallucinations like `reqeusts`, `openaisdk`) or has 0 valid releases (placeholder squatted packages like `colorsys2`) will **immediately block the PR**.
- If your PR introduces a new dependency, please ensure it is legitimate and explain why it is necessary in your PR description.

### 3. AST Blast-Radius & Scope Creep Gate
- GhostRepro measures the Abstract Syntax Tree (AST) statement delta ($\Delta$) of your patch:
  $$\Delta = |\text{Statements}_{\text{modified}} - \text{Statements}_{\text{original}}|$$
- For single-issue bug fixes, $\Delta$ must remain **under 50 statements**.
- Scope creep triggers: Adding unrelated utility functions, touching files outside the bug's blast radius, or injecting multi-hundred-line formatting diffs will flag your PR for scope creep.

### 4. Mathematical Bug Reproduction Proof (RED ──► GREEN)
- Every bug fix PR must satisfy an autonomous reproduction test (`test_repro_<id>.py`).
- The test must fail on the baseline codebase (**RED**), proving the bug is real.
- The test must pass on your PR branch (**GREEN**), mathematically proving the fix works.
- Your code will be subjected to **128 adversarial fuzzing mutations** to ensure the fix does not contain trivial bypass cheats (e.g. `if discount == 150: return 50`).

### 5. Real GitHub Upstream Incorporation & Squash Merge
- Once all zero-trust criteria are met (AST blast radius passed, PyPI dependencies clean, RED ➔ GREEN flip confirmed, 128 mutation tests survived):
  - Maintainers authorize your contribution directly in the Mission Control Dashboard or Live Agent Studio.
  - The platform sends an official GitHub review approval (`POST /reviews`), performs an automated squash merge (`PUT /merge`), and posts a signed zero-trust proof badge to your PR timeline.
  - If quarantined initially (first-time contributor or bot), maintainer authorization immediately triggers the GitHub review and merge flow.

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js** (v18+) and **pnpm** or **npm**
- **Python** (v3.10+) and **pip**

### 1. Clone the Repository
```bash
git clone https://github.com/asfandkhan8585-cpu/GhostReproMissionControlDashboard.git
cd GhostReproMissionControlDashboard
```

### 2. Frontend Dashboard Setup
```bash
# Install dependencies
npm install
# or
pnpm install

# Start Vite development server
npm run dev
# Server will run on http://localhost:8443 or http://localhost:5173
```

### 3. Visual Verification in Live Agent Studio
- Open `http://localhost:8443` and click **Live Agent Studio [LAB]** in the sidebar.
- Run the autonomous workflow to observe the 7-phase verification pipeline in action (AST scan, streaming test synthesis, sandbox RED failure, live code diff patch, sandbox GREEN flip, and the 128 mutation test matrix).

### 4. Backend Orchestrator & Groq LLM Setup
```bash
cd backend
pip install -r requirements.txt

# Configure your Groq Open-Source LLM API key in .env:
# GROQ_API_KEY=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
# GROQ_MODEL=llama-3.3-70b-versatile
# GROQ_BASE_URL=https://api.groq.com/openai/v1

uvicorn app.main:app --reload --port 8000
```
Health Check: `http://localhost:8000/api/health`
LLM LPU Test: `http://localhost:8000/api/config/test-llm`

## 🧪 Running the Live End-to-End Test Suite

Before opening a pull request, run the comprehensive live verification suite against the local backend server (`http://127.0.0.1:8000`):

```bash
python test_live_system.py
```

All 95 tests must pass with 0 failures. The test suite covers health endpoints, user and repo persistence, real PyPI lookups, AST calculations, bug reproduction synthesis, pytest sandbox runs, and SQLite integrity.

---

## 🤖 Using the Autonomous Agents for Verification

GhostRepro includes 3 specialized autonomous agents located in `.agents/` and `agents/`. We encourage you to run them before submitting code:

1. **Testing Agent (`testing-agent`)**:
   Runs the full behavioral test suite across all dashboard tabs, verifying buttons, forms, and state transitions:
   ```bash
   python agents/testing_agent/test_runner.py
   ```

2. **Review Agent (`review-agent`)**:
   Adversarial zero-context reviewer that audits your diff strictly from first principles without optimistic assumptions:
   ```bash
   python agents/review_agent/review_checklist.py
   ```

3. **Screenshot Agent (`screenshot-agent`)**:
   Visual verification inspector that guarantees ZERO empty space and theme consistency across all views:
   ```bash
   python agents/screenshot_agent/visual_inspector.py
   ```

---

## 🎨 UI & Design Guidelines

If you are modifying the frontend Mission Control Dashboard:
- **Strict Zero-Mock Data Policy**: The application must never fabricate mock responses. Real API endpoints must be called; if no data exists or an error occurs, report it transparently.
- **Zero Empty Space**: Never leave blank or collapsed panels. When data lists are empty, render high-density informational widgets or fallback cards.
- **Design System Tokens**: Use the established dark palette (`#101514`, `#121a16`, `#141c18`), green accents for verified items (`#8edaa1`, `#3fb950`), red for bug proofs and blocked slop (`#ff8a80`), and amber for quarantine (`#f1cf81`).
- **Typography**: Use `DM Sans` for UI copy and `IBM Plex Mono` for telemetry, pytest code, statement deltas, and terminal logs.
- **Interactivity**: Every `<button>` must have an active `onClick` handler and provide visual feedback (toast notification or inline badge).

---

## 📝 Pull Request Checklist

Before submitting your PR, please verify:
- [ ] My PR targets the `main` branch.
- [ ] I have provided a concise description of the bug or feature.
- [ ] No hallucinated or unverified dependencies have been introduced.
- [ ] No mock or fabricated data is used in place of live API calls.
- [ ] The AST blast-radius is minimal ($\Delta \le 50$ statements for bug fixes).
- [ ] All buttons and interactive controls work without throwing console errors.
- [ ] The dashboard views comply with the **Zero Empty Space** standard.
- [ ] All unit, live system tests (`python test_live_system.py`), and reproduction tests pass.

---

## 💬 Community & Questions
Need help or want to suggest an improvement? Open an issue on GitHub or reach out to the lead maintainer at `@asfandkhan8585-cpu`. Happy coding!
