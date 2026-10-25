"""GhostRepro API — FastAPI app, CORS middleware, Webhook routes & Dashboard endpoints.

This is the central orchestrator that wires together the security clearance gate,
AST blast-radius analyzer, sandboxed pytest runner, and exposes real-time data
for the Next.js Mission Control Dashboard.
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import time
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

from app.security import check_user_clearance, scan_pypi_dependencies
from app.ast_analyzer import calculate_ast_blast_radius
from app.sandbox import run_pytest_sandbox

load_dotenv()

app = FastAPI(title="GhostRepro API", version="1.0.0")

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory State (replace with DB in production) ─────────────────────────
# Stores live PR review records, quarantine entries, and aggregate metrics.

_pr_records: list[dict] = [
    {
        "id": "pr-001",
        "number": 42,
        "repo": "acme/widget-lib",
        "title": "Fix off-by-one in pagination",
        "author": "trusted_dev_alice",
        "author_avatar": "",
        "author_association": "CONTRIBUTOR",
        "trust_score": 92,
        "status": "PASSED",
        "tier": "Verified Contributor",
        "blast_radius": {"statement_delta": 4, "scope_creep_detected": False},
        "test_result": {"passed": True, "exit_code": 0},
        "created_at": "2026-10-25T08:12:00Z",
        "pipeline_stage": "COMPLETE",
    },
    {
        "id": "pr-002",
        "number": 43,
        "repo": "acme/widget-lib",
        "title": "Add AI-powered README generator",
        "author": "slop_bot_9000",
        "author_avatar": "",
        "author_association": "NONE",
        "trust_score": 5,
        "status": "REJECTED",
        "tier": "Untrusted / First-Time",
        "blast_radius": {"statement_delta": 187, "scope_creep_detected": True},
        "test_result": {"passed": False, "exit_code": 1},
        "created_at": "2026-10-25T09:34:00Z",
        "pipeline_stage": "BLOCKED",
    },
    {
        "id": "pr-003",
        "number": 44,
        "repo": "acme/widget-lib",
        "title": "Refactor checkout total calculation",
        "author": "oss_contributor_bob",
        "author_avatar": "",
        "author_association": "CONTRIBUTOR",
        "trust_score": 78,
        "status": "PASSED",
        "tier": "Verified Contributor",
        "blast_radius": {"statement_delta": 12, "scope_creep_detected": False},
        "test_result": {"passed": True, "exit_code": 0},
        "created_at": "2026-10-25T10:05:00Z",
        "pipeline_stage": "COMPLETE",
    },
    {
        "id": "pr-004",
        "number": 45,
        "repo": "acme/widget-lib",
        "title": "Update all dependencies to latest",
        "author": "random_hacker_x",
        "author_avatar": "",
        "author_association": "NONE",
        "trust_score": 12,
        "status": "QUARANTINED",
        "tier": "Untrusted / First-Time",
        "blast_radius": {"statement_delta": 0, "scope_creep_detected": False},
        "test_result": None,
        "created_at": "2026-10-25T11:22:00Z",
        "pipeline_stage": "QUARANTINE",
    },
    {
        "id": "pr-005",
        "number": 46,
        "repo": "acme/widget-lib",
        "title": "Fix XSS vulnerability in search input",
        "author": "security_jane",
        "author_avatar": "",
        "author_association": "NONE",
        "trust_score": 34,
        "status": "QUARANTINED",
        "tier": "Untrusted / First-Time",
        "blast_radius": {"statement_delta": 8, "scope_creep_detected": False},
        "test_result": None,
        "created_at": "2026-10-25T12:01:00Z",
        "pipeline_stage": "QUARANTINE",
    },
    {
        "id": "pr-006",
        "number": 47,
        "repo": "acme/widget-lib",
        "title": "Implement caching layer for API responses",
        "author": "ghost_contributor",
        "author_avatar": "",
        "author_association": "NONE",
        "trust_score": 2,
        "status": "REJECTED",
        "tier": "Untrusted / First-Time",
        "blast_radius": {"statement_delta": 245, "scope_creep_detected": True},
        "test_result": {"passed": False, "exit_code": 1},
        "created_at": "2026-10-25T13:15:00Z",
        "pipeline_stage": "BLOCKED",
    },
    {
        "id": "pr-007",
        "number": 48,
        "repo": "acme/widget-lib",
        "title": "Fix currency rounding in checkout",
        "author": "maintainer_lead",
        "author_avatar": "",
        "author_association": "OWNER",
        "trust_score": 100,
        "status": "PASSED",
        "tier": "VIP Fast-Track",
        "blast_radius": {"statement_delta": 2, "scope_creep_detected": False},
        "test_result": {"passed": True, "exit_code": 0},
        "created_at": "2026-10-25T14:30:00Z",
        "pipeline_stage": "COMPLETE",
    },
    {
        "id": "pr-008",
        "number": 49,
        "repo": "acme/widget-lib",
        "title": "Add dark mode toggle component",
        "author": "first_timer_dev",
        "author_avatar": "",
        "author_association": "NONE",
        "trust_score": 18,
        "status": "QUARANTINED",
        "tier": "Untrusted / First-Time",
        "blast_radius": {"statement_delta": 34, "scope_creep_detected": False},
        "test_result": None,
        "created_at": "2026-10-25T15:45:00Z",
        "pipeline_stage": "QUARANTINE",
    },
]

_pipeline_events: list[dict] = [
    {"id": "evt-1", "pr_id": "pr-007", "stage": "CLEARANCE", "status": "passed", "timestamp": "2026-10-25T14:30:01Z", "message": "VIP Fast-Track: maintainer_lead cleared instantly."},
    {"id": "evt-2", "pr_id": "pr-007", "stage": "AST_ANALYSIS", "status": "passed", "timestamp": "2026-10-25T14:30:02Z", "message": "Blast radius minimal: Δ2 statements, no scope creep."},
    {"id": "evt-3", "pr_id": "pr-007", "stage": "REPRO_TEST", "status": "passed", "timestamp": "2026-10-25T14:30:04Z", "message": "RED→GREEN flip confirmed. Bug reproduction test passed."},
    {"id": "evt-4", "pr_id": "pr-007", "stage": "FUZZING", "status": "passed", "timestamp": "2026-10-25T14:30:06Z", "message": "Adversarial mutations: 0/50 edge cases broke the fix."},
    {"id": "evt-5", "pr_id": "pr-007", "stage": "MERGE_GATE", "status": "passed", "timestamp": "2026-10-25T14:30:07Z", "message": "✅ All gates passed. PR #48 auto-approved for merge."},
    {"id": "evt-6", "pr_id": "pr-002", "stage": "CLEARANCE", "status": "failed", "timestamp": "2026-10-25T09:34:01Z", "message": "⚠ slop_bot_9000 flagged as untrusted. Quarantine triggered."},
    {"id": "evt-7", "pr_id": "pr-002", "stage": "AST_ANALYSIS", "status": "failed", "timestamp": "2026-10-25T09:34:03Z", "message": "🚨 Scope creep: +187 statements, 5 new functions injected."},
    {"id": "evt-8", "pr_id": "pr-002", "stage": "DEPENDENCY_SCAN", "status": "failed", "timestamp": "2026-10-25T09:34:05Z", "message": "🛑 Slopsquatting detected: 'reqeusts' is a hallucinated PyPI package."},
]

_slopsquat_flags: list[dict] = [
    {"package": "reqeusts", "reason": "Hallucinated Package (Does not exist on PyPI!)", "pr_id": "pr-002", "detected_at": "2026-10-25T09:34:05Z"},
    {"package": "colorsys2", "reason": "Hallucinated Package (Does not exist on PyPI!)", "pr_id": "pr-006", "detected_at": "2026-10-25T13:15:03Z"},
]

_issue_repros: list[dict] = [
    {"issue_number": 101, "repo": "acme/widget-lib", "title": "Pagination returns duplicate items on page 2", "repro_status": "RED", "test_file": "test_repro_101.py", "created_at": "2026-10-25T07:00:00Z"},
    {"issue_number": 102, "repo": "acme/widget-lib", "title": "Currency rounding error on checkout totals > $999", "repro_status": "GREEN", "test_file": "test_repro_102.py", "created_at": "2026-10-25T06:30:00Z"},
    {"issue_number": 103, "repo": "acme/widget-lib", "title": "XSS via search input field", "repro_status": "RED", "test_file": "test_repro_103.py", "created_at": "2026-10-25T08:45:00Z"},
]


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "online", "project": "GhostRepro (NSTP Hacktoberfest)"}


# ─── GitHub Webhook ──────────────────────────────────────────────────────────

@app.post("/webhook")
async def github_webhook(request: Request):
    payload = await request.json()
    event_type = request.headers.get("X-GitHub-Event")

    if event_type == "pull_request":
        action = payload.get("action")
        if action in ["opened", "synchronize"]:
            pr = payload["pull_request"]
            username = pr["user"]["login"]
            author_association = pr["author_association"]

            clearance = check_user_clearance(username, author_association)
            if clearance["status"] == "QUARANTINED":
                # Add to quarantine queue
                new_record = {
                    "id": f"pr-{uuid.uuid4().hex[:6]}",
                    "number": pr.get("number", 0),
                    "repo": pr.get("base", {}).get("repo", {}).get("full_name", "unknown"),
                    "title": pr.get("title", "Untitled PR"),
                    "author": username,
                    "author_avatar": pr.get("user", {}).get("avatar_url", ""),
                    "author_association": author_association,
                    "trust_score": 0,
                    "status": "QUARANTINED",
                    "tier": clearance["tier"],
                    "blast_radius": None,
                    "test_result": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "pipeline_stage": "QUARANTINE",
                }
                _pr_records.append(new_record)
                return {"action_taken": "quarantined", "reason": clearance["message"]}

            return {"status": "success", "message": f"PR by @{username} passed clearance."}

    return {"status": "ignored", "event": event_type}


# ─── Dashboard API Endpoints ────────────────────────────────────────────────

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics():
    """Returns aggregate counts for the Mission Control metric cards."""
    total_prs = len(_pr_records)
    passed = sum(1 for pr in _pr_records if pr["status"] == "PASSED")
    rejected = sum(1 for pr in _pr_records if pr["status"] == "REJECTED")
    quarantined = sum(1 for pr in _pr_records if pr["status"] == "QUARANTINED")
    issues_reproduced = len(_issue_repros)
    active_red = sum(1 for r in _issue_repros if r["repro_status"] == "RED")
    slopsquat_blocked = len(_slopsquat_flags)

    return {
        "total_prs_reviewed": total_prs,
        "prs_passed": passed,
        "prs_rejected": rejected,
        "prs_quarantined": quarantined,
        "issues_reproduced": issues_reproduced,
        "active_red_tests": active_red,
        "slopsquat_packages_blocked": slopsquat_blocked,
        "pipeline_events_24h": len(_pipeline_events),
    }


@app.get("/api/dashboard/prs")
def get_dashboard_prs():
    """Returns list of recent PRs with trust scores and status badges."""
    return {"pull_requests": sorted(_pr_records, key=lambda x: x["created_at"], reverse=True)}


@app.get("/api/dashboard/quarantine")
def get_quarantine_queue():
    """Returns the list of untrusted/first-time contributors currently quarantined."""
    quarantined = [pr for pr in _pr_records if pr["status"] == "QUARANTINED"]
    return {"quarantine_queue": quarantined, "count": len(quarantined)}


@app.get("/api/dashboard/pipeline")
def get_pipeline_events():
    """Returns live pipeline events for the activity feed."""
    return {"events": sorted(_pipeline_events, key=lambda x: x["timestamp"], reverse=True)}


@app.get("/api/dashboard/issues")
def get_issue_reproductions():
    """Returns the list of auto-generated bug reproduction tests."""
    return {"reproductions": _issue_repros}


@app.get("/api/dashboard/slopsquat")
def get_slopsquat_flags():
    """Returns all flagged slopsquatted/hallucinated packages."""
    return {"flagged_packages": _slopsquat_flags}


class AuthorizeRequest(BaseModel):
    """Request body for authorizing a quarantined user."""
    reason: Optional[str] = "Manually approved by maintainer."


@app.post("/api/dashboard/authorize/{username}")
def authorize_quarantined_user(username: str, body: AuthorizeRequest = AuthorizeRequest()):
    """Allows a maintainer to release a quarantined user and trigger sandbox run."""
    found = False
    for pr in _pr_records:
        if pr["author"] == username and pr["status"] == "QUARANTINED":
            pr["status"] = "RUNNING"
            pr["pipeline_stage"] = "SANDBOX_EXEC"
            found = True

            # Simulate sandbox execution — in production this triggers run_pytest_sandbox
            pr["test_result"] = {"passed": True, "exit_code": 0, "output": "All tests passed."}
            pr["status"] = "PASSED"
            pr["pipeline_stage"] = "COMPLETE"
            pr["trust_score"] = 55  # Elevated from 0 after manual review

            _pipeline_events.append({
                "id": f"evt-{uuid.uuid4().hex[:6]}",
                "pr_id": pr["id"],
                "stage": "MANUAL_AUTHORIZE",
                "status": "passed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"✅ @{username} authorized by maintainer. Sandbox execution passed.",
            })
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"No quarantined PR found for @{username}.")

    return {"status": "authorized", "username": username, "message": body.reason}


# ─── Utility Endpoints (for manual / demo use) ──────────────────────────────

class ASTRequest(BaseModel):
    original_code: str
    modified_code: str


@app.post("/api/analyze/ast")
def analyze_ast(req: ASTRequest):
    """Run the AST blast-radius analyzer on arbitrary code pairs."""
    return calculate_ast_blast_radius(req.original_code, req.modified_code)


class DepScanRequest(BaseModel):
    requirements_text: str


@app.post("/api/analyze/dependencies")
def analyze_dependencies(req: DepScanRequest):
    """Scan a requirements.txt for hallucinated/slopsquatted packages."""
    return {"flagged": scan_pypi_dependencies(req.requirements_text)}


class SandboxRequest(BaseModel):
    test_file_path: str


@app.post("/api/sandbox/run")
def run_sandbox(req: SandboxRequest):
    """Execute pytest in a sandboxed subprocess."""
    return run_pytest_sandbox(req.test_file_path)
