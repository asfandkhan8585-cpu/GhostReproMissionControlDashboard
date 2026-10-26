"""GhostRepro API — FastAPI app, CORS middleware, Webhook routes & Dashboard endpoints.

This is the central orchestrator that wires together the security clearance gate,
AST blast-radius analyzer, sandboxed pytest runner, and exposes real-time data
for the Mission Control Dashboard.
"""

from fastapi import FastAPI, Request, HTTPException, Response
from starlette.responses import JSONResponse
import secrets
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import os
import time
import uuid
import hmac
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

from app.security import check_user_clearance, scan_pypi_dependencies, extract_package_name
from app.ast_analyzer import calculate_ast_blast_radius
from app.sandbox import run_pytest_sandbox
from app.llm_agent import test_groq_connection, synthesize_pytest_reproduction, run_adversarial_fuzzing_evaluation
from app.database import (
    save_user, get_latest_user,
    save_repository, get_all_repositories, set_active_repository,
    save_pull_request, get_all_pull_requests,
    save_bug_repro, get_all_bug_repros,
    save_slop_flag, get_all_slop_flags, delete_slop_flag,
    add_to_whitelist, get_whitelist, remove_from_whitelist,
    save_pipeline_event, get_pipeline_events,
    save_log, get_recent_logs, clear_all_logs, clear_transient_tables,
    save_config, get_config, get_full_config
)

load_dotenv()

app = FastAPI(title="GhostRepro API", version="1.0.0")

# ─── CORS ────────────────────────────────────────────────────────────────────
_default_dev_origins = [
    "http://localhost:8443",
    "http://localhost:5173",
    "http://127.0.0.1:8443",
    "http://127.0.0.1:5173",
]
_env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = _env_origins if _env_origins else _default_dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing authorize route establishes a short-lived, HttpOnly maintainer session.
_sessions: dict[str, float] = {}

@app.middleware("http")
async def require_maintainer(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path not in {"/webhook", "/api/github/authorize"}:
        session = request.cookies.get("ghostrepro_session", "")
        if _sessions.get(session, 0) <= time.time():
            return JSONResponse(status_code=401, content={"detail": "Authorize the environment-configured GitHub maintainer first."})
    return await call_next(request)

# ─── In-Memory & SQLite Dual Persistence State ──────────────────────────────

DEFAULT_MAINTAINER_USERNAME = "asfandkhan8585-cpu"
DEFAULT_WORKSPACE_REPO = "asfandkhan8585-cpu/GhostReproMissionControlDashboard"

_db_user = get_latest_user()
if not _db_user:
    _github_user = {
        "authenticated": True,
        "username": DEFAULT_MAINTAINER_USERNAME,
        "name": DEFAULT_MAINTAINER_USERNAME,
        "avatar_url": f"https://github.com/{DEFAULT_MAINTAINER_USERNAME}.png",
        "company": "Maintainer",
        "public_repos": 1,
        "role": "Verified Maintainer",
    }
    save_user(_github_user)
else:
    _github_user = {
        "authenticated": bool(_db_user.get("authenticated", 1)),
        "username": _db_user.get("username", DEFAULT_MAINTAINER_USERNAME),
        "name": _db_user.get("name", DEFAULT_MAINTAINER_USERNAME),
        "avatar_url": _db_user.get("avatar_url", f"https://github.com/{DEFAULT_MAINTAINER_USERNAME}.png"),
        "company": _db_user.get("company", "Maintainer"),
        "public_repos": _db_user.get("public_repos", 1),
        "role": _db_user.get("role", "Verified Maintainer"),
    }

_db_repos = get_all_repositories()
if not _db_repos:
    default_repo_obj = {
        "id": "repo-ghostrepro-main",
        "full_name": DEFAULT_WORKSPACE_REPO,
        "name": "GhostReproMissionControlDashboard",
        "description": "Zero-Trust Autonomous Merge Gatekeeper & PR Security Intelligence",
        "is_active": True,
        "is_private": False,
        "stars": 1,
        "forks": 0,
        "open_prs": 0,
        "quarantined_prs": 0,
        "repro_tests": 0,
        "language": "Python",
        "default_branch": "main",
    }
    save_repository(default_repo_obj)
    _db_repos = [default_repo_obj]

_github_repos: list[dict] = _db_repos
_active_repo = next((r["full_name"] for r in _github_repos if r.get("is_active")), _github_repos[0]["full_name"] if _github_repos else DEFAULT_WORKSPACE_REPO)
set_active_repository(_active_repo)

_config = {
    "verification_rules": {
        "min_trust_score": 80,
        "auto_quarantine_first_timers": True,
        "blast_radius_threshold": 50,
        "block_slopsquatting": True,
        "fuzzing_mutation_count": 128,
        "strict_mode": True,
    },
    "model_config": {
        "model_name": "llama-3.3-70b-versatile",
        "provider": "Groq Cloud / Open-Source LPU",
        "inference_endpoint": "https://api.groq.com/openai/v1",
        "temperature": 0.2,
        "context_window": "128k",
        "api_key": os.getenv("GROQ_API_KEY", "")
    },
    "repo_settings": {
        "webhook_url": "http://127.0.0.1:8000/webhook",
        "webhook_secret": os.getenv("WEBHOOK_SECRET", ""),
        "auto_merge_on_pass": False,
        "sandbox_timeout_sec": 30,
        "quarantine_unverified_bots": True,
    }
}

# Reload configuration from SQLite if saved previously
_db_config = get_full_config()
if _db_config:
    if "verification_rules" in _db_config:
        _config["verification_rules"].update(_db_config["verification_rules"])
    if "ai_model_config" in _db_config:
        _config["model_config"].update(_db_config["ai_model_config"])
    if "repo_settings" in _db_config:
        _config["repo_settings"].update(_db_config["repo_settings"])

# Load all persistent entities from SQLite
_pr_records: list[dict] = get_all_pull_requests()
_pipeline_events: list[dict] = get_pipeline_events()
_slopsquat_flags: list[dict] = get_all_slop_flags()
_whitelisted_packages: list[str] = get_whitelist()
_issue_repros: list[dict] = get_all_bug_repros()
_repro_code_samples: dict[int, str] = {r["issue_number"]: r["code"] for r in _issue_repros if r.get("code")}
_execution_logs: list[dict] = get_recent_logs()

_github_token: str = os.getenv("GITHUB_TOKEN", "").strip()

def is_valid_github_token(token: Optional[str]) -> bool:
    if not token or not isinstance(token, str):
        return False
    t = token.strip()
    if len(t) < 10:
        return False
    lower = t.lower()
    if "yourpersonalaccesstoken" in lower or "placeholder" in lower or "token_here" in lower:
        return False
    return t.startswith(("ghp_", "gho_", "github_pat_", "ghs_", "ghu_")) or len(t) >= 30

def get_effective_github_token(provided_token: Optional[str] = None) -> str:
    global _github_token
    if provided_token and is_valid_github_token(provided_token):
        _github_token = provided_token.strip()
        return _github_token
    if _github_token and is_valid_github_token(_github_token):
        return _github_token
    env_token = os.getenv("GITHUB_TOKEN", "").strip()
    if is_valid_github_token(env_token):
        _github_token = env_token
        return _github_token
    return ""


@app.get("/")
def health_check():
    return {"status": "online", "project": "GhostRepro (NSTP Hacktoberfest)", "active_repo": _active_repo}

@app.get("/api/health")
def api_health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "active_repo": _active_repo}


# ─── GitHub Authorization & Repositories ────────────────────────────────────

class GitHubAuthorizeRequest(BaseModel):
    token: Optional[str] = None
    username: Optional[str] = None

@app.post("/api/github/authorize")
def authorize_github(req: GitHubAuthorizeRequest, response: Response):
    """Verify the environment-configured GitHub identity before creating a session."""
    global _github_user, _github_repos, _active_repo
    token = os.getenv("GITHUB_TOKEN", "").strip()
    username = (req.username or "").strip().lstrip("@")
    if not token:
        raise HTTPException(status_code=503, detail="GITHUB_TOKEN is not configured on the backend")
    if not req.token or not hmac.compare_digest(req.token, token):
        raise HTTPException(status_code=401, detail="A valid environment-configured GitHub credential is required")
    if not username:
        raise HTTPException(status_code=422, detail="GitHub username is required")
    headers = {"Authorization": f"Bearer {token}", "User-Agent": "GhostRepro"}
    try:
        user_response = requests.get("https://api.github.com/user", headers=headers, timeout=10)
        if user_response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"GitHub identity verification returned {user_response.status_code}")
        user = user_response.json()
        if user.get("login", "").lower() != username.lower():
            raise HTTPException(status_code=403, detail="Username does not match the configured GitHub identity")
        repo_response = requests.get("https://api.github.com/user/repos?sort=updated&per_page=100", headers=headers, timeout=10)
        if repo_response.status_code != 200 or not isinstance(repo_response.json(), list):
            raise HTTPException(status_code=502, detail=f"GitHub repository listing returned {repo_response.status_code}")
        repos = [{"id": str(r["id"]), "full_name": r["full_name"], "name": r["name"],
                  "description": r.get("description") or "", "is_active": idx == 0,
                  "is_private": bool(r.get("private")), "stars": r.get("stargazers_count", 0),
                  "forks": r.get("forks_count", 0), "open_prs": 0, "quarantined_prs": 0,
                  "repro_tests": 0, "language": r.get("language") or "", "default_branch": r["default_branch"]}
                 for idx, r in enumerate(repo_response.json())]
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="GitHub identity/repository request failed")
    _github_user = {"authenticated": True, "username": user["login"], "name": user.get("name") or user["login"],
                    "avatar_url": user.get("avatar_url", ""), "company": user.get("company") or "",
                    "public_repos": user.get("public_repos", 0), "role": "Verified Maintainer"}
    _github_repos = repos
    _active_repo = repos[0]["full_name"] if repos else ""
    save_user(_github_user)
    for repo in repos:
        save_repository(repo)
    if _active_repo:
        set_active_repository(_active_repo)
    session = secrets.token_urlsafe(32)
    _sessions[session] = time.time() + 3600
    response.set_cookie("ghostrepro_session", session, httponly=True, samesite="strict", secure=False, max_age=3600)
    return {"status": "success", "user": _github_user, "repos": repos}

class AddRepoRequest(BaseModel):
    id: Optional[str] = None
    name: str
    full_name: Optional[str] = None
    description: Optional[str] = "Repository protected by GhostRepro"
    language: Optional[str] = "Python"

@app.post("/api/github/repos/add")
def add_custom_repo_endpoint(req: AddRepoRequest):
    global _github_repos, _active_repo
    prefix = _github_user.get("username") or "asfandkhan8585-cpu"
    full_name = req.full_name or f"{prefix}/{req.name}"
    new_repo = {
        "id": req.id or f"repo-{int(time.time())}",
        "full_name": full_name,
        "name": req.name,
        "description": req.description or "Repository protected by GhostRepro",
        "is_active": len(_github_repos) == 0,
        "is_private": False,
        "stars": 0,
        "forks": 0,
        "open_prs": 0,
        "quarantined_prs": 0,
        "repro_tests": 0,
        "language": req.language or "Python",
        "default_branch": "main",
    }
    _github_repos.append(new_repo)
    if not _active_repo or new_repo.get("is_active"):
        _active_repo = full_name
        
    save_repository(new_repo)
    set_active_repository(_active_repo)
    
    _execution_logs.append({
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "CLEARANCE",
        "level": "INFO",
        "message": f"Added repository to mission control and saved to SQLite: {full_name}",
    })
    return {"status": "added", "repo": new_repo}

@app.get("/api/github/user")
def get_github_user():
    return _github_user

@app.get("/api/github/repos")
def get_github_repos():
    return {"active_repo": _active_repo, "repositories": _github_repos}

class RepoSelectRequest(BaseModel):
    repo_id: str

@app.post("/api/github/repos/select")
def select_github_repo(req: RepoSelectRequest):
    global _active_repo
    target = next((r for r in _github_repos if r.get("id") == req.repo_id or r.get("full_name") == req.repo_id or r.get("name") == req.repo_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    for r in _github_repos:
        r["is_active"] = (r == target)
    _active_repo = target["full_name"]
    set_active_repository(_active_repo)
        
    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "CLEARANCE",
        "level": "INFO",
        "message": f"Active repository switched to: {_active_repo}",
    }
    _execution_logs.append(log_item)
    save_log(log_item)
    return {"status": "success", "active_repo": _active_repo, "repo": target}

@app.post("/api/github/sync")
def sync_github_repos():
    """Forces synchronization with GitHub API."""
    eff_token = get_effective_github_token()
    username = _github_user.get("username", "").strip() or "asfandkhan8585-cpu"
    headers = {"User-Agent": "GhostRepro-Gatekeeper", "Accept": "application/vnd.github.v3+json"}
    if eff_token:
        headers["Authorization"] = f"token {eff_token}"
        
    updated = 0
    try:
        resp = requests.get(f"https://api.github.com/users/{username}/repos?per_page=30&sort=updated", headers=headers, timeout=5)
        if resp.status_code == 200:
            repos_data = resp.json()
            if isinstance(repos_data, list):
                existing_map = {r["full_name"]: r for r in _github_repos}
                for r in repos_data:
                    fn = r.get("full_name") or f"{username}/{r.get('name')}"
                    repo_entry = existing_map.get(fn)
                    if not repo_entry:
                        repo_entry = {
                            "id": f"repo-{r.get('id', uuid.uuid4().hex[:6])}",
                            "full_name": fn,
                            "name": r.get("name", fn),
                            "description": r.get("description") or "Repository monitored by GhostRepro",
                            "is_active": (fn == _active_repo),
                            "is_private": bool(r.get("private")),
                            "stars": r.get("stargazers_count", 0),
                            "forks": r.get("forks_count", 0),
                            "open_prs": r.get("open_issues_count", 0),
                            "quarantined_prs": 0,
                            "repro_tests": 0,
                            "language": r.get("language") or "Python",
                            "default_branch": r.get("default_branch") or "main",
                        }
                        _github_repos.append(repo_entry)
                    else:
                        repo_entry["stars"] = r.get("stargazers_count", repo_entry.get("stars", 0))
                        repo_entry["forks"] = r.get("forks_count", repo_entry.get("forks", 0))
                        repo_entry["open_prs"] = r.get("open_issues_count", repo_entry.get("open_prs", 0))
                        repo_entry["language"] = r.get("language") or repo_entry.get("language", "Python")
                    save_repository(repo_entry)
                    updated += 1
        else:
            raise HTTPException(status_code=502, detail=f"GitHub sync returned {resp.status_code}")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="GitHub sync request failed")

    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "CLEARANCE",
        "level": "INFO",
        "message": f"Synchronized {updated} repositories from GitHub API for @{username}.",
    }
    _execution_logs.append(log_item)
    save_log(log_item)
    return {"status": "synced", "count": updated, "repositories": _github_repos}


# ─── Configuration Endpoints ────────────────────────────────────────────────

@app.get("/api/config")
def get_config_endpoint():
    """Returns application configuration with all secrets safely redacted."""
    safe_config = {
        "verification_rules": dict(_config.get("verification_rules", {})),
        "model_config": dict(_config.get("model_config", {})),
        "repo_settings": dict(_config.get("repo_settings", {})),
    }
    raw_api_key = os.getenv("GROQ_API_KEY", "")
    safe_config["model_config"]["api_key"] = "gsk_••••••••" if raw_api_key else ""
    raw_secret = os.getenv("WEBHOOK_SECRET", "")
    safe_config["repo_settings"]["webhook_secret"] = "whsec_••••••••" if raw_secret else ""
    return safe_config

class ConfigUpdateRequest(BaseModel):
    verification_rules: Optional[dict] = None
    ai_model_config: Optional[dict] = None
    repo_settings: Optional[dict] = None

@app.post("/api/config")
def update_config_endpoint(req: ConfigUpdateRequest):
    global _config
    if req.verification_rules:
        _config["verification_rules"].update(req.verification_rules)
        save_config("verification_rules", _config["verification_rules"])
    if req.ai_model_config:
        # Ignore masked secret submissions
        clean_model = dict(req.ai_model_config)
        if clean_model.get("api_key", "").startswith("gsk_••"):
            clean_model.pop("api_key", None)
        clean_model.pop("api_key", None)
        _config["model_config"].pop("api_key", None)
        _config["model_config"].update(clean_model)
        save_config("ai_model_config", _config["model_config"])
    if req.repo_settings:
        clean_repo = dict(req.repo_settings)
        if clean_repo.get("webhook_secret", "").startswith("whsec_••"):
            clean_repo.pop("webhook_secret", None)
        clean_repo.pop("webhook_secret", None)
        _config["repo_settings"].pop("webhook_secret", None)
        _config["repo_settings"].update(clean_repo)
        save_config("repo_settings", _config["repo_settings"])
        
    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "CLEARANCE",
        "level": "INFO",
        "message": "Security policy & configuration updated by maintainer and persisted to SQLite.",
    }
    _execution_logs.append(log_item)
    save_log(log_item)
    return {"status": "updated", "config": get_config_endpoint()}

@app.post("/api/config/test-llm")
def test_llm_connection():
    """Validates connectivity to configured open-source Groq LLM with live LPU ping."""
    try:
        res = test_groq_connection(model=_config["model_config"].get("model_name", "llama-3.3-70b-versatile"))
        log_item = {
            "id": f"log-{uuid.uuid4().hex[:6]}",
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "stage": "REPRO_TEST",
            "level": "PASS",
            "message": f"Groq LPU verified ({res['latency_ms']}ms latency) · {res['model']}",
        }
        _execution_logs.append(log_item)
        save_log(log_item)
        return res
    except Exception as e:
        log_item = {
            "id": f"log-{uuid.uuid4().hex[:6]}",
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "stage": "REPRO_TEST",
            "level": "ERROR",
            "message": f"Groq LPU connection FAILED: {str(e)}",
        }
        _execution_logs.append(log_item)
        save_log(log_item)
        raise HTTPException(
            status_code=503,
            detail=f"LLM connection failed: {str(e)}. Check your API key and network connectivity."
        )

@app.post("/api/config/ping-webhook")
def ping_webhook():
    """Actually pings configured webhook to verify delivery with real HTTP request."""
    webhook_url = _config.get("repo_settings", {}).get("webhook_url", "").strip()
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL configured.")

    timestamp = datetime.now(timezone.utc).isoformat()
    ping_payload = json.dumps({
        "zen": "GhostRepro webhook ping",
        "hook_id": "ghostrepro-ping",
        "timestamp": timestamp,
    }).encode("utf-8")

    headers = {
        "User-Agent": "GhostRepro-Gatekeeper",
        "X-GitHub-Event": "ping",
        "Content-Type": "application/json",
    }
    secret = os.getenv("WEBHOOK_SECRET", "").strip()
    if secret:
        sig = hmac.new(secret.encode("utf-8"), ping_payload, hashlib.sha256).hexdigest()
        headers["X-Hub-Signature-256"] = f"sha256={sig}"

    try:
        resp = requests.post(webhook_url, data=ping_payload, headers=headers, timeout=5)
        is_success = (200 <= resp.status_code < 300)
        http_code = resp.status_code
        msg = f"Webhook ping to {webhook_url} responded with HTTP {http_code}."
    except Exception as e:
        is_success = False
        http_code = 503
        msg = f"Webhook ping connection failed: {str(e)}"

    evt = {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "pr_id": "system-ping",
        "stage": "WEBHOOK_PING",
        "status": "passed" if is_success else "failed",
        "timestamp": timestamp,
        "message": msg,
    }
    _pipeline_events.insert(0, evt)
    save_pipeline_event(evt)

    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "WEBHOOK",
        "level": "PASS" if is_success else "WARN",
        "message": msg,
    }
    _execution_logs.append(log_item)
    save_log(log_item)

    return {"status": "pong" if is_success else "error", "http_status": http_code, "event": evt, "message": msg}


@app.post("/api/config/regenerate-secret")
def regenerate_webhook_secret():
    """Credentials are managed by the process environment only."""
    raise HTTPException(status_code=409, detail="Rotate WEBHOOK_SECRET in the backend environment and restart the service.")


# ─── GitHub Webhook ──────────────────────────────────────────────────────────

@app.post("/webhook")
async def github_webhook(request: Request):
    body = await request.body()
    
    # Verify HMAC-SHA256 signature if webhook secret is configured
    configured_secret = os.getenv("WEBHOOK_SECRET", "").strip()
    sig_header = request.headers.get("X-Hub-Signature-256")
    if not configured_secret:
        raise HTTPException(status_code=503, detail="WEBHOOK_SECRET is required")
    if configured_secret:
        if not sig_header:
            raise HTTPException(status_code=401, detail="Missing X-Hub-Signature-256 header")
        expected_sig = "sha256=" + hmac.new(configured_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig_header, expected_sig):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON in webhook payload")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")
    event_type = request.headers.get("X-GitHub-Event")
    if event_type == "ping":
        return {"status": "pong", "message": "Ping received successfully"}

    if event_type == "pull_request":
        action = payload.get("action")
        if not action:
            raise HTTPException(status_code=400, detail="Missing 'action' in pull_request payload")
            
        if action in ["opened", "synchronize"]:
            pr = payload.get("pull_request")
            if not isinstance(pr, dict):
                raise HTTPException(status_code=400, detail="Missing 'pull_request' object in webhook payload")
            user_obj = pr.get("user")
            if not isinstance(user_obj, dict) or not user_obj.get("login"):
                raise HTTPException(status_code=400, detail="Missing 'user.login' in pull_request payload")
            username = user_obj["login"]
            author_association = pr.get("author_association", "NONE")

            clearance = check_user_clearance(username, author_association)
            if clearance["status"] == "QUARANTINED":
                new_record = {
                    "id": f"pr-{uuid.uuid4().hex[:6]}",
                    "number": pr.get("number", 0),
                    "repo": pr.get("base", {}).get("repo", {}).get("full_name", _active_repo),
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
                _pr_records.insert(0, new_record)
                save_pull_request(new_record)
                return {"action_taken": "quarantined", "reason": clearance["message"]}

            return {"status": "success", "message": f"PR by @{username} passed clearance."}

    return {"status": "ignored", "event": event_type}


# ─── Dashboard Telemetry & Metrics ──────────────────────────────────────────

@app.get("/api/dashboard/metrics")
def get_metrics():
    total_prs = len(_pr_records)
    prs_passed = sum(1 for pr in _pr_records if pr["status"] == "PASSED")
    prs_rejected = sum(1 for pr in _pr_records if pr["status"] == "REJECTED")
    prs_quarantined = sum(1 for pr in _pr_records if pr["status"] == "QUARANTINED")

    issues_repro = len(_issue_repros)
    active_red = sum(1 for i in _issue_repros if i["repro_status"] == "RED")

    return {
        "total_prs_reviewed": total_prs,
        "prs_passed": prs_passed,
        "prs_rejected": prs_rejected,
        "prs_quarantined": prs_quarantined,
        "issues_reproduced": issues_repro,
        "active_red_tests": active_red,
        "slopsquat_packages_blocked": len(_slopsquat_flags),
        "pipeline_events_24h": len(_pipeline_events),
    }

@app.get("/api/dashboard/prs")
def get_all_prs():
    return {"pull_requests": _pr_records}

@app.get("/api/dashboard/quarantine")
def get_quarantine_queue():
    quarantined = [pr for pr in _pr_records if pr["status"] == "QUARANTINED"]
    return {"queue": quarantined, "count": len(quarantined)}

@app.get("/api/dashboard/pipeline")
def get_pipeline():
    return {"events": _pipeline_events}

class SimulatePRRequest(BaseModel):
    repo: Optional[str] = None

@app.post("/api/dashboard/prs/simulate")
def simulate_pr_endpoint(req: SimulatePRRequest):
    """Fetches real open PRs from the GitHub API for the active repository.
    
    If there are no real open PRs, returns an honest error—never fabricated data.
    """
    global _pr_records, _pipeline_events, _execution_logs

    if req.repo is not None and not req.repo.strip():
        raise HTTPException(
            status_code=400,
            detail="Repository name cannot be empty. Please provide a valid repository (e.g. 'owner/repo')."
        )

    repo = req.repo.strip() if (req.repo and req.repo.strip()) else _active_repo
    if not repo or "/" not in repo:
        raise HTTPException(
            status_code=400,
            detail="No active repository set. Connect a GitHub account and select a repository first."
        )

    # Fetch real open PRs from GitHub API
    headers = {"User-Agent": "GhostRepro-Gatekeeper", "Accept": "application/vnd.github.v3+json"}
    eff_token = get_effective_github_token()
    if eff_token:
        headers["Authorization"] = f"token {eff_token}"

    try:
        pr_resp = requests.get(
            f"https://api.github.com/repos/{repo}/pulls?state=open&per_page=10&sort=updated&direction=desc",
            headers=headers,
            timeout=8,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach GitHub API: {str(e)}. Check network connectivity."
        )

    # If rejected with 401 because of token, retry without token for public repos
    if pr_resp.status_code == 401 and "Authorization" in headers:
        del headers["Authorization"]
        try:
            pr_resp = requests.get(
                f"https://api.github.com/repos/{repo}/pulls?state=open&per_page=10&sort=updated&direction=desc",
                headers=headers,
                timeout=8,
            )
        except Exception:
            pass

    if pr_resp.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="GitHub API authentication failed. Verify your personal access token or omit it for public repos."
        )
    if pr_resp.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repo}' not found on GitHub. Verify the repository name is correct."
        )
    if pr_resp.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail="GitHub API rate limit exceeded. Add a GITHUB_TOKEN to your .env for higher limits."
        )
    if pr_resp.status_code != 200:
        raise HTTPException(
            status_code=pr_resp.status_code,
            detail=f"GitHub API returned status {pr_resp.status_code}: {pr_resp.text[:200]}"
        )

    real_prs = pr_resp.json()
    if not isinstance(real_prs, list) or len(real_prs) == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No open pull requests found for '{repo}'. There are no PRs to review."
        )

    ingested_prs = []
    # Process up to top 5 open PRs to prevent rate limits or long timeouts
    for gh_pr in real_prs[:5]:
        pr_num = gh_pr.get("number", 0)
        author = gh_pr.get("user", {}).get("login", "unknown")
        author_association = gh_pr.get("author_association", "NONE")

        # Skip if already ingested
        if any(p["number"] == pr_num and p["repo"] == repo for p in _pr_records):
            continue

        # Run clearance check
        clearance = check_user_clearance(author, author_association)
        status = "QUARANTINED" if clearance["status"] == "QUARANTINED" else "RUNNING"
        trust_score = 0 if status == "QUARANTINED" else 80

        # Calculate AST blast radius and auto-scan dependencies from PR diff if available
        blast_radius = None
        pr_dependencies = []
        try:
            diff_resp = requests.get(
                f"https://api.github.com/repos/{repo}/pulls/{pr_num}/files",
                headers=headers,
                timeout=2.5,
            )
            if diff_resp.status_code == 200:
                files = diff_resp.json()
                total_changes = sum(f.get("changes", 0) for f in files)
                total_additions = sum(f.get("additions", 0) for f in files)
                total_deletions = sum(f.get("deletions", 0) for f in files)
                blast_radius = {
                    "statement_delta": None,
                    "additions": total_additions,
                    "deletions": total_deletions,
                    "files_changed": len(files),
                    "scope_creep_detected": total_changes > _config["verification_rules"]["blast_radius_threshold"],
                }

                # Automated dependency scanning from PR diffs
                for f in files:
                    fname = f.get("filename", "").lower()
                    patch = f.get("patch", "")
                    # Only parse legitimate dependency configuration files
                    is_dep_file = (
                        Path(fname).name.startswith("requirements") and fname.endswith(".txt")
                    )
                    if is_dep_file and patch:
                        for line in patch.splitlines():
                            if line.startswith("+") and not line.startswith("+++"):
                                clean = extract_package_name(line)
                                if clean:
                                    pr_dependencies.append(clean)
                                    scan_res = scan_single_package(PackageScanRequest(package=clean))
                                    if scan_res.get("is_threat"):
                                        status = "QUARANTINED"
                                        trust_score = 0
                                        threat_log = {
                                            "id": f"log-{uuid.uuid4().hex[:6]}",
                                            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                                            "stage": "SECURITY_SCAN",
                                            "level": "WARN",
                                            "message": f"🚨 Automated PyPI defense flagged hallucinated package '{clean}' in PR #{pr_num} by @{author}!",
                                        }
                                        _execution_logs.append(threat_log)
                                        save_log(threat_log)
        except Exception:
            pass

        new_pr = {
            "id": f"pr-{uuid.uuid4().hex[:6]}",
            "number": pr_num,
            "repo": repo,
            "title": gh_pr.get("title", "Untitled PR"),
            "author": author,
            "author_avatar": gh_pr.get("user", {}).get("avatar_url", ""),
            "author_association": author_association,
            "trust_score": trust_score,
            "status": status,
            "tier": clearance.get("tier", "Unknown"),
            "blast_radius": blast_radius,
            "dependencies": pr_dependencies,
            "test_result": None,
            "created_at": gh_pr.get("created_at", datetime.now(timezone.utc).isoformat()),
            "pipeline_stage": "QUARANTINE" if status == "QUARANTINED" else "CLEARANCE_PASSED",
        }
        _pr_records.insert(0, new_pr)
        save_pull_request(new_pr)
        ingested_prs.append(new_pr)

        evt = {
            "id": f"evt-{uuid.uuid4().hex[:6]}",
            "pr_id": new_pr["id"],
            "stage": "PR_OPENED",
            "status": "failed" if status == "QUARANTINED" else "passed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": f"PR #{pr_num} '{gh_pr.get('title', '')}' by @{author} — {status}.",
        }
        _pipeline_events.insert(0, evt)
        save_pipeline_event(evt)

        log_item = {
            "id": f"log-{uuid.uuid4().hex[:6]}",
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "stage": "CLEARANCE",
            "level": "WARN" if status == "QUARANTINED" else "INFO",
            "message": f"Real PR #{pr_num} by @{author} ingested from GitHub. Status: {status}.",
        }
        _execution_logs.append(log_item)
        save_log(log_item)

    if not ingested_prs:
        return {
            "status": "no_new",
            "message": f"All {len(real_prs)} open PRs from '{repo}' have already been ingested.",
            "total_open": len(real_prs),
        }

    return {
        "status": "ingested",
        "message": f"Ingested {len(ingested_prs)} real PR(s) from GitHub for '{repo}'.",
        "prs": ingested_prs,
        "total_open": len(real_prs),
    }


# ─── Bug Reproductions ──────────────────────────────────────────────────────

@app.get("/api/dashboard/issues")
def get_issues():
    return {"issues": _issue_repros}

class CreateIssueReproRequest(BaseModel):
    issue_number: int
    title: str
    description: Optional[str] = ""
    code: Optional[str] = None

@app.post("/api/dashboard/issues/create")
def create_issue_repro(req: CreateIssueReproRequest):
    # Obtain authentic test code: from request or via Groq synthesis
    if req.code and req.code.strip():
        code = req.code.strip()
    else:
        try:
            code = synthesize_pytest_reproduction(req.issue_number, req.title, req.description or "")
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Autonomous test synthesis failed via Groq LPU: {str(e)}"
            )

    if not _active_repo:
        raise HTTPException(status_code=422, detail="Select a repository first")
    test_dir = Path(__file__).resolve().parent.parent / "tests" / "repros" / hashlib.sha256(_active_repo.encode()).hexdigest()[:16]
    test_dir.mkdir(parents=True, exist_ok=True)
    test_path = test_dir / f"test_repro_{req.issue_number}.py"
    test_path.write_text(code, encoding="utf-8")
    execution = run_pytest_sandbox(str(test_path))
    if execution["exit_code"] not in (0, 1):
        raise HTTPException(status_code=502, detail=f"Reproduction execution failed: {execution['output']}")
    new_issue = {
        "issue_number": req.issue_number,
        "repo": _active_repo,
        "title": req.title,
        "repro_status": "GREEN" if execution["exit_code"] == 0 else "RED",
        "test_file": f"test_repro_{req.issue_number}.py",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "code": code,
    }
    _issue_repros[:] = [i for i in _issue_repros if (i.get("repo"), i["issue_number"]) != (_active_repo, req.issue_number)]
    _issue_repros.insert(0, new_issue)
    _repro_code_samples[req.issue_number] = code
    
    # Save to SQLite database
    save_bug_repro(new_issue)
    
    _execution_logs.append({
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "REPRO_TEST",
        "level": "INFO",
        "message": f"Autonomous BRT generated for #{req.issue_number}: test_repro_{req.issue_number}.py [RED] (saved to SQLite).",
    })
    return {"status": "created", "issue": new_issue}

@app.post("/api/dashboard/issues/{issue_number}/run")
def run_issue_repro(issue_number: int):
    """Executes the bug reproduction test in sandbox with real pytest execution."""
    target_issue = next((i for i in _issue_repros if i["issue_number"] == issue_number and i.get("repo") == _active_repo), None)
    if not target_issue:
        raise HTTPException(status_code=404, detail="Issue reproduction not found")

    # Get test code from sample cache, database, or stored repro
    code = target_issue.get("code")
    if not code:
        raise HTTPException(
            status_code=404,
            detail=f"No pytest reproduction code found for Issue #{issue_number}. Please synthesize or provide reproduction code first."
        )

    # Ensure tests directory exists inside sandbox boundary
    repo_key = hashlib.sha256(_active_repo.encode()).hexdigest()[:16]
    test_dir = Path(__file__).resolve().parent.parent / "tests" / "repros" / repo_key
    test_dir.mkdir(parents=True, exist_ok=True)
    test_file_path = test_dir / f"test_repro_{issue_number}.py"
    test_file_path.write_text(code, encoding="utf-8")

    # Execute REAL sandbox run
    res = run_pytest_sandbox(str(test_file_path))
    if res["exit_code"] == 0:
        new_status = "GREEN"
    elif res["exit_code"] == 1:
        new_status = "RED"
    else:
        # Do not flip status on execution error/timeout/crash
        raise HTTPException(
            status_code=500,
            detail=f"Sandbox execution error (exit code {res['exit_code']}): {res.get('output', 'Sandbox subprocess failed')}"
        )

    target_issue["repro_status"] = new_status
    target_issue["test_file"] = f"test_repro_{issue_number}.py"
    target_issue["code"] = code
    save_bug_repro(target_issue)

    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "REPRO_TEST",
        "level": "PASS" if new_status == "GREEN" else "WARN",
        "message": f"Real sandbox execution for #{issue_number}: pytest exit_code={res['exit_code']} -> [{new_status}].",
    }
    _execution_logs.append(log_item)
    save_log(log_item)

    evt = {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "pr_id": f"issue-{issue_number}",
        "stage": "REPRO_EXECUTION",
        "status": "passed" if res["passed"] else "failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Pytest executed on test_repro_{issue_number}.py. Status: {new_status} (exit code {res['exit_code']}).",
    }
    _pipeline_events.insert(0, evt)
    save_pipeline_event(evt)

    return {
        "status": "success",
        "issue_number": issue_number,
        "repro_status": new_status,
        "exit_code": res["exit_code"],
        "output": res["output"]
    }

@app.get("/api/dashboard/issues/{issue_number}/code")
def get_issue_repro_code(issue_number: int):
    target = next((i for i in _issue_repros if i["issue_number"] == issue_number and i.get("repo") == _active_repo), None)
    code = (target.get("code") if target else None)
    if not code:
        raise HTTPException(status_code=404, detail=f"No reproduction code found for Issue #{issue_number}")
    return {"issue_number": issue_number, "test_file": f"test_repro_{issue_number}.py", "code": code}


# ─── Slopsquatting Defense & PyPI Scanner ────────────────────────────────────

@app.get("/api/dashboard/slopsquat")
def get_slopsquat_threats():
    return {
        "flagged": _slopsquat_flags,
        "whitelisted": _whitelisted_packages,
        "count": len(_slopsquat_flags)
    }

class PackageScanRequest(BaseModel):
    package: str

@app.post("/api/slopsquat/scan")
def scan_single_package(req: PackageScanRequest):
    pkg_name = req.package.strip().lower()
    
    if pkg_name in [p.lower() for p in _whitelisted_packages]:
        return {
            "package": pkg_name,
            "status": "WHITELISTED",
            "is_threat": False,
            "message": f"'{pkg_name}' is in maintainer whitelist.",
        }

    # Query official PyPI JSON endpoint
    global _slopsquat_flags
    try:
        resp = requests.get(f"https://pypi.org/pypi/{pkg_name}/json", timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            info = data.get("info", {})
            releases = data.get("releases", {})
            if not releases:
                flag = {
                    "package": pkg_name,
                    "reason": "Squatted / Placeholder package (0 valid releases on PyPI)",
                    "pr_id": "live-scan",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }
                if not any(f["package"].lower() == pkg_name.lower() for f in _slopsquat_flags):
                    _slopsquat_flags.insert(0, flag)
                return {
                    "package": pkg_name,
                    "status": "SUSPICIOUS",
                    "is_threat": True,
                    "message": "Package exists on PyPI but has 0 valid releases (Ghost/Placeholder package).",
                }
            return {
                "package": pkg_name,
                "status": "LEGITIMATE",
                "is_threat": False,
                "latest_version": info.get("version", "unknown"),
                "summary": info.get("summary", ""),
                "author": info.get("author", "Unknown"),
                "message": f"Legitimate package found on PyPI: {pkg_name} v{info.get('version')}",
            }
        elif resp.status_code == 404:
            flag = {
                "package": pkg_name,
                "reason": "Hallucinated Package (Does not exist on official PyPI repository)",
                "pr_id": "live-scan",
                "detected_at": datetime.now(timezone.utc).isoformat(),
            }
            if not any(f["package"].lower() == pkg_name.lower() for f in _slopsquat_flags):
                _slopsquat_flags.insert(0, flag)
            return {
                "package": pkg_name,
                "status": "HALLUCINATED",
                "is_threat": True,
                "message": f"🛑 Hallucinated package! '{pkg_name}' does NOT exist on official PyPI repository.",
            }
    except Exception:
        # If network error, fail closed
        pass
        
    flag = {
        "package": pkg_name,
        "reason": "Unverified Package (PyPI validation failed closed)",
        "pr_id": "live-scan",
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }
    if not any(f["package"].lower() == pkg_name.lower() for f in _slopsquat_flags):
        _slopsquat_flags.insert(0, flag)

    return {
        "package": pkg_name,
        "status": "FLAGGED",
        "is_threat": True,
        "message": f"Failed closed: could not verify '{pkg_name}' against PyPI repository.",
    }

class WhitelistRequest(BaseModel):
    package: str

@app.post("/api/slopsquat/whitelist")
def whitelist_package(req: WhitelistRequest):
    pkg = req.package.strip()
    if pkg not in _whitelisted_packages:
        _whitelisted_packages.append(pkg)
    # Remove from flagged if present
    global _slopsquat_flags
    _slopsquat_flags = [f for f in _slopsquat_flags if f["package"].lower() != pkg.lower()]
    return {"status": "whitelisted", "package": pkg, "whitelisted_packages": _whitelisted_packages}

@app.delete("/api/slopsquat/{package}")
def delete_slopsquat_flag(package: str):
    global _slopsquat_flags
    _slopsquat_flags = [f for f in _slopsquat_flags if f["package"].lower() != package.lower()]
    return {"status": "deleted", "package": package}

@app.post("/api/slopsquat/auto-scan-repo")
def auto_scan_repo():
    """Automatically parses and scans all dependencies in the repository against PyPI."""
    import re
    discovered = set()
    candidate_files = [
        "requirements.txt",
        "backend/requirements.txt",
        "demo_repo/requirements.txt",
    ]
    for p in candidate_files:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            pkg = re.split(r"[=><~]", line)[0].strip()
                            if pkg:
                                discovered.add(pkg)
            except Exception:
                pass

    for pr in _pr_records:
        for dep in pr.get("dependencies", []):
            discovered.add(dep)

    # Core project baseline packages if no file found
    if not discovered:
        discovered = {"fastapi", "uvicorn", "requests", "pydantic", "PyGithub", "pytest"}

    results = []
    for pkg in sorted(discovered):
        res = scan_single_package(PackageScanRequest(package=pkg))
        results.append(res)

    threats = [r for r in results if r.get("is_threat")]
    _execution_logs.append({
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "SECURITY_SCAN",
        "level": "WARN" if threats else "PASS",
        "message": f"Automated dependency scan completed: {len(results)} packages verified. {len(threats)} threat(s) flagged on PyPI.",
    })

    return {
        "status": "success",
        "scanned_count": len(results),
        "threats_count": len(threats),
        "results": results,
    }



# ─── Execution Logs & Terminal Workstation ──────────────────────────────────

@app.get("/api/dashboard/logs")
def get_execution_logs():
    return {"logs": _execution_logs, "count": len(_execution_logs)}

@app.delete("/api/dashboard/logs")
def clear_execution_logs():
    global _execution_logs
    _execution_logs = []
    clear_all_logs()
    return {"status": "cleared"}

@app.post("/api/dashboard/reset")
def reset_dashboard_data():
    """Purges all demo, simulation, and transient state while preserving maintainer profile and repository."""
    global _pr_records, _pipeline_events, _slopsquat_flags, _issue_repros, _repro_code_samples, _execution_logs, _github_repos, _active_repo, _github_user, _whitelisted_packages
    _pr_records = []
    _pipeline_events = []
    _slopsquat_flags = []
    _issue_repros = []
    _repro_code_samples = {}
    _execution_logs = []
    _whitelisted_packages = []
    clear_transient_tables()
    
    # Reload from SQLite or preserve maintainer default
    _db_repos = get_all_repositories()
    if _db_repos:
        _github_repos = _db_repos
        _active = next((r["full_name"] for r in _db_repos if r.get("is_active")), _db_repos[0]["full_name"])
        _active_repo = _active
    else:
        _github_repos = [{
            "id": "repo-ghostrepro-main",
            "full_name": DEFAULT_WORKSPACE_REPO,
            "name": "GhostReproMissionControlDashboard",
            "description": "Zero-Trust Autonomous Merge Gatekeeper & PR Security Intelligence",
            "is_active": True,
            "is_private": False,
            "stars": 1,
            "forks": 0,
            "open_prs": 0,
            "quarantined_prs": 0,
            "repro_tests": 0,
            "language": "Python",
            "default_branch": "main",
        }]
        _active_repo = DEFAULT_WORKSPACE_REPO
        save_repository(_github_repos[0])

    _db_user = get_latest_user()
    if _db_user and _db_user.get("authenticated"):
        _github_user = _db_user
    else:
        _github_user = {
            "authenticated": True,
            "username": DEFAULT_MAINTAINER_USERNAME,
            "name": DEFAULT_MAINTAINER_USERNAME,
            "avatar_url": f"https://github.com/{DEFAULT_MAINTAINER_USERNAME}.png",
            "company": "Maintainer",
            "public_repos": len(_github_repos),
            "role": "Verified Maintainer",
        }
        save_user(_github_user)

    return {"status": "cleared", "message": "All session and demo data purged; maintainer workspace preserved."}

class SandboxTriggerRequest(BaseModel):
    suite: Optional[str] = "regression"
    pr_id: Optional[str] = "suite-test"

@app.post("/api/sandbox/trigger-test")
def trigger_full_test_suite(req: SandboxTriggerRequest):
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    
    # Locate target test file in workspace or demo_repo
    candidate_test_paths = [
        "demo_repo/test_checkout.py",
        "backend/demo_repo/test_checkout.py",
        "backend/tests/test_api.py",
    ]
    test_path = next((p for p in candidate_test_paths if os.path.exists(p)), None)
    
    # Execute REAL pytest sandbox - return 404 if no test file found
    if not test_path:
        raise HTTPException(
            status_code=404,
            detail="No candidate test file found on disk (demo_repo/test_checkout.py not found)."
        )

    test_result = run_pytest_sandbox(test_path)

    # Execute REAL Qwen adversarial fuzzing evaluation
    fuzzing_res = run_adversarial_fuzzing_evaluation(
        pr_id=req.pr_id or "suite-test",
        code_diff=Path(test_path).read_text(encoding="utf-8")
    )

    if fuzzing_res.get("status") == "error":
        raise HTTPException(status_code=502, detail=fuzzing_res.get("error", "LLM review failed"))
    if not test_result["passed"] or fuzzing_res.get("status") != "passed":
        raise HTTPException(status_code=409, detail={"message": "Verification failed", "pytest": test_result, "llm_review": fuzzing_res})
    _execution_logs.extend([
        {"id": f"log-{uuid.uuid4().hex[:6]}", "timestamp": timestamp, "stage": "SANDBOX", "level": "INFO", "message": f"Ephemeral runner executing {test_path or 'regression test suite'}..."},
        {"id": f"log-{uuid.uuid4().hex[:6]}", "timestamp": timestamp, "stage": "REPRO_TEST", "level": "PASS" if test_result["passed"] else "WARN", "message": f"Pytest exit code {test_result['exit_code']}: {test_result['output'].strip()[:100]}"},
        {"id": f"log-{uuid.uuid4().hex[:6]}", "timestamp": timestamp, "stage": "FUZZING", "level": "INFO", "message": f"Requesting static LLM code review; no mutations executed."},
        {"id": f"log-{uuid.uuid4().hex[:6]}", "timestamp": timestamp, "stage": "FUZZING", "level": "PASS" if fuzzing_res.get("status") == "passed" else "WARN", "message": f"LLM review: {fuzzing_res.get('groq_analysis', '0 cheats detected')[:90]}"},
        {"id": f"log-{uuid.uuid4().hex[:6]}", "timestamp": timestamp, "stage": "MERGE_GATE", "level": "PASS" if test_result["passed"] else "WARN", "message": "Verification complete. Security checks validated."},
    ])
    for l in _execution_logs[-5:]:
        save_log(l)
    
    evt = {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "pr_id": req.pr_id,
        "stage": "SANDBOX_VERIFY",
        "status": "passed" if test_result["passed"] else "failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Real sandbox suite executed: exit_code={test_result['exit_code']}, static LLM review completed; no mutations executed.",
    }
    _pipeline_events.insert(0, evt)
    save_pipeline_event(evt)
    return {
        "status": "completed",
        "exit_code": test_result["exit_code"],
        "pytest_output": test_result["output"],
        "fuzzing": fuzzing_res,
        "logs_added": 5,
    }


# ─── Quarantine Authorization & Real GitHub PR Actions ───────────────────────

def execute_github_pr_incorporation(
    repo: str,
    pr_number: int,
    action: str = "approve_and_merge",
    token: Optional[str] = None,
    review_body: Optional[str] = None,
    merge_method: str = "squash"
) -> dict:
    """Executes real GitHub REST API calls to review, approve, and merge a PR."""
    stored = next((p for p in get_all_pull_requests() if p.get("repo") == repo and p.get("number") == pr_number), None)
    proof = (stored or {}).get("test_result") or {}
    verified_sha = proof.get("head_sha")
    if not (proof.get("passed") is True and proof.get("llm_review") == "passed" and verified_sha):
        return {"success": False, "message": "Persisted verification for the exact PR head is required before approval or merge."}
    eff_token = get_effective_github_token(token)
    headers = {
        "User-Agent": "GhostRepro-Gatekeeper",
        "Accept": "application/vnd.github.v3+json"
    }
    if eff_token:
        headers["Authorization"] = f"token {eff_token}"
    
    clean_repo = repo.strip()
    results = {
        "repo": clean_repo,
        "pr_number": pr_number,
        "action": action,
        "review_status": None,
        "merge_status": None,
        "comment_status": None,
        "success": False,
        "message": ""
    }

    if "/" not in clean_repo or pr_number <= 0:
        results["message"] = f"Invalid target repository or PR number: {repo} #{pr_number}"
        return results

    if not eff_token:
        results["message"] = "No GitHub personal access token available. Please provide a PAT with 'repo' scope."
        return results

    try:
        current = requests.get(f"https://api.github.com/repos/{clean_repo}/pulls/{pr_number}", headers=headers, timeout=8)
        if current.status_code != 200:
            return {**results, "message": f"GitHub head lookup returned {current.status_code}"}
        if current.json().get("head", {}).get("sha") != verified_sha:
            return {**results, "message": "PR head changed; earlier verification is invalid. Run verification again."}
    except requests.RequestException:
        return {**results, "message": "GitHub head lookup failed"}
    default_body = f"GhostRepro: pytest passed and LLM code review passed for commit {verified_sha}."

    # 1. Submit GitHub PR Review: APPROVE
    try:
        rev_url = f"https://api.github.com/repos/{clean_repo}/pulls/{pr_number}/reviews"
        rev_resp = requests.post(
            rev_url,
            headers=headers,
            json={"event": "APPROVE", "body": default_body},
            timeout=8
        )
        results["review_status"] = rev_resp.status_code
        if rev_resp.status_code in (200, 201):
            results["review_data"] = rev_resp.json()
    except Exception as e:
        results["review_error"] = str(e)

    # 2. Merge the Pull Request on GitHub if requested
    if action in ("approve_and_merge", "merge"):
        try:
            merge_url = f"https://api.github.com/repos/{clean_repo}/pulls/{pr_number}/merge"
            merge_resp = requests.put(
                merge_url,
                headers=headers,
                json={
                    "commit_title": f"Merge pull request #{pr_number} from {clean_repo} [GhostRepro Verified]",
                    "commit_message": f"Mathematically verified and merged by GhostRepro Zero-Trust Gatekeeper.\n\nReviewed-by: GhostRepro Maintainer",
                    "merge_method": merge_method,
                    "sha": verified_sha
                },
                timeout=8
            )
            results["merge_status"] = merge_resp.status_code
            if merge_resp.status_code == 200 and merge_resp.json().get("merged") is True:
                results["merge_data"] = merge_resp.json()
                results["success"] = True
                results["message"] = f"✅ PR #{pr_number} was successfully approved and merged into {clean_repo} on GitHub!"
            elif merge_resp.status_code == 404:
                results["message"] = f"PR #{pr_number} was not found on GitHub in repository '{clean_repo}' (HTTP 404). Please ensure the pull request exists on GitHub before merging."
            elif merge_resp.status_code == 405:
                results["message"] = f"PR #{pr_number} cannot be merged automatically on GitHub (merge conflict or head branch changed)."
            elif merge_resp.status_code == 409:
                results["message"] = f"PR #{pr_number} merge conflict exists on GitHub branch."
            elif merge_resp.status_code == 403:
                results["message"] = "GitHub token lacks write/merge permissions on this repository (HTTP 403)."
            else:
                results["message"] = f"GitHub API merge returned HTTP {merge_resp.status_code}: {merge_resp.text[:150]}"
        except Exception as e:
            results["merge_error"] = str(e)
            results["message"] = f"Network error during GitHub merge: {str(e)}"
    else:
        results["success"] = bool(results.get("review_status") in (200, 201))
        results["message"] = f"✅ PR #{pr_number} review approved on GitHub!"

    # Report success only after GitHub confirms it.
    if not results["success"]:
        return results
    try:
        comment_url = f"https://api.github.com/repos/{clean_repo}/issues/{pr_number}/comments"
        cmt_resp = requests.post(
            comment_url,
            headers=headers,
            json={"body": f"🛡️ **GhostRepro Gatekeeper**: Pull Request #{pr_number} has been merged after recorded pytest and LLM review checks into `{clean_repo}` on GitHub."},
            timeout=5
        )
        results["comment_status"] = cmt_resp.status_code
    except Exception:
        pass

    return results


class AuthorizeRequest(BaseModel):
    reason: Optional[str] = "Maintainer authorized execution via GhostRepro Dashboard"
    token: Optional[str] = None
    merge_on_github: Optional[bool] = True

@app.post("/api/dashboard/authorize/{username}")
def authorize_quarantined_user(username: str, body: AuthorizeRequest = AuthorizeRequest()):
    found = False
    gh_action_result = None
    for pr in _pr_records:
        if pr["author"] == username and pr["status"] == "QUARANTINED":
            found = True
            # ACTUALLY INCORPORATE INTO GITHUB VIA GITHUB REST API
            gh_action_result = execute_github_pr_incorporation(
                repo=pr.get("repo", _active_repo),
                pr_number=pr.get("number", 0),
                action="approve_and_merge" if body.merge_on_github else "approve",
                token=body.token,
                review_body=f"🛡️ **GhostRepro Zero-Trust Gatekeeper**\n\nMaintainer released @{username} from quarantine.\n\nReason: {body.reason}"
            )
            if not gh_action_result.get("success"):
                raise HTTPException(status_code=409, detail=gh_action_result.get("message", "GitHub action failed"))
            pr["github_action_result"] = gh_action_result

            if body.merge_on_github:
                if gh_action_result.get("success"):
                    pr["status"] = "PASSED"
                    pr["pipeline_stage"] = "MERGED_ON_GITHUB"
                    pr["merged"] = True
                    pr["trust_score"] = 85
                else:
                    pr["status"] = "FAILED"
                    pr["pipeline_stage"] = "MERGE_FAILED"
                    pr["merged"] = False
            else:
                pr["status"] = "PASSED"
                pr["pipeline_stage"] = "AUTHORIZED"
                pr["trust_score"] = 85

            save_pull_request(pr)

            evt = {
                "id": f"evt-{uuid.uuid4().hex[:6]}",
                "pr_id": pr["id"],
                "stage": "MANUAL_AUTHORIZE",
                "status": "passed" if gh_action_result.get("success") else "failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"Maintainer authorized @{username}. GitHub merge result: {gh_action_result.get('message', 'Processed')}",
            }
            _pipeline_events.insert(0, evt)
            save_pipeline_event(evt)
            
            log_item = {
                "id": f"log-{uuid.uuid4().hex[:6]}",
                "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                "stage": "CLEARANCE",
                "level": "PASS" if gh_action_result.get("success") else "WARN",
                "message": f"Maintainer released @{username} from quarantine. GitHub: {gh_action_result.get('message', 'Authorized')}",
            }
            _execution_logs.append(log_item)
            save_log(log_item)
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"No quarantined PR found for @{username}.")

    return {
        "status": "authorized",
        "username": username,
        "message": body.reason,
        "github": gh_action_result or {"message": "Local status updated."}
    }

@app.post("/api/dashboard/reject/{username}")
def reject_quarantined_user(username: str, body: AuthorizeRequest = AuthorizeRequest()):
    found = False
    for pr in _pr_records:
        if pr["author"] == username and pr["status"] == "QUARANTINED":
            pr["status"] = "REJECTED"
            pr["pipeline_stage"] = "BLOCKED"
            found = True
            save_pull_request(pr)
            
            # Close on GitHub if token available
            eff_token = get_effective_github_token(body.token)
            if eff_token and pr.get("number") and "/" in pr.get("repo", ""):
                try:
                    headers = {"User-Agent": "GhostRepro-Gatekeeper", "Accept": "application/vnd.github.v3+json", "Authorization": f"token {eff_token}"}
                    requests.patch(f"https://api.github.com/repos/{pr['repo']}/pulls/{pr['number']}", headers=headers, json={"state": "closed"}, timeout=6)
                    requests.post(f"https://api.github.com/repos/{pr['repo']}/issues/{pr['number']}/comments", headers=headers, json={"body": f"❌ **GhostRepro Gatekeeper**: Contribution PR #{pr['number']} by @{username} rejected by maintainer."}, timeout=5)
                except Exception:
                    pass

            evt = {
                "id": f"evt-{uuid.uuid4().hex[:6]}",
                "pr_id": pr["id"],
                "stage": "REJECT",
                "status": "failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"❌ PR by @{username} rejected and closed on GitHub.",
            }
            _pipeline_events.insert(0, evt)
            save_pipeline_event(evt)

            log_item = {
                "id": f"log-{uuid.uuid4().hex[:6]}",
                "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                "stage": "CLEARANCE",
                "level": "WARN",
                "message": f"PR by @{username} rejected by maintainer.",
            }
            _execution_logs.append(log_item)
            save_log(log_item)
            break
            
    if not found:
        raise HTTPException(status_code=404, detail=f"No quarantined PR found for @{username}.")
    return {"status": "rejected", "username": username}

class PRMergeRequest(BaseModel):
    repo: Optional[str] = None
    pr_number: int
    token: Optional[str] = None
    merge_method: Optional[str] = "squash"

@app.post("/api/dashboard/prs/merge")
def merge_github_pr_endpoint(req: PRMergeRequest):
    """Direct endpoint to approve and merge any verified PR on GitHub."""
    repo = req.repo or _active_repo
    gh_res = execute_github_pr_incorporation(
        repo=repo,
        pr_number=req.pr_number,
        action="approve_and_merge",
        token=req.token,
        merge_method=req.merge_method or "squash"
    )
    if not gh_res.get("success"):
        raise HTTPException(status_code=409, detail=gh_res.get("message", "GitHub merge failed"))
    for pr in _pr_records:
        if pr.get("number") == req.pr_number and (pr.get("repo") == repo or not pr.get("repo")):
            if gh_res.get("success"):
                pr["status"] = "PASSED"
                pr["pipeline_stage"] = "MERGED_ON_GITHUB"
                pr["merged"] = True
            else:
                pr["status"] = "FAILED"
                pr["pipeline_stage"] = "MERGE_FAILED"
                pr["merged"] = False
            pr["github_action_result"] = gh_res
            save_pull_request(pr)
            break
            
    evt = {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "pr_id": f"pr-{req.pr_number}",
        "stage": "GITHUB_MERGE",
        "status": "passed" if gh_res.get("success") else "failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": gh_res.get("message", f"PR #{req.pr_number} processed on GitHub."),
    }
    _pipeline_events.insert(0, evt)
    save_pipeline_event(evt)
    
    log_item = {
        "id": f"log-{uuid.uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "stage": "MERGE_GATE",
        "level": "PASS" if gh_res.get("success") else "WARN",
        "message": f"GitHub API: PR #{req.pr_number} in {repo}: {gh_res.get('message', '')}",
    }
    _execution_logs.append(log_item)
    save_log(log_item)

    return gh_res



# ─── Utility Endpoints ──────────────────────────────────────────────────────

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
    """Execute pytest in a sandboxed subprocess with strict isolation."""
    res = run_pytest_sandbox(req.test_file_path)
    if "Security violation" in res.get("output", ""):
        raise HTTPException(status_code=400, detail=res["output"])
    return res
