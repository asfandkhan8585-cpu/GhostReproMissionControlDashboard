"""GhostRepro Live System Verification & Testing Suite.

Executes live HTTP API requests against the running local backend (http://127.0.0.1:8000),
validates all security gate pipelines, AST engine, PyPI scanner, and SQLite persistence.

ALL tests use REAL data from live API calls — zero mock/fabricated data.
"""

import urllib.request
import urllib.error
import json
import sqlite3
import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

passed = 0
failed = 0
errors = []


def req(path: str, method: str = "GET", data: dict = None, expect_error: bool = False):
    """Make an HTTP request to the backend. If expect_error=True, returns the error response instead of raising."""
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if expect_error:
            try:
                body = json.loads(e.read().decode("utf-8"))
                return {"_http_status": e.code, **body}
            except Exception:
                return {"_http_status": e.code, "detail": str(e)}
        raise


def test(name: str, condition: bool, detail: str = ""):
    """Record a test result."""
    global passed, failed, errors
    if condition:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        msg = f"  ✗ FAIL: {name}"
        if detail:
            msg += f" — {detail}"
        print(msg)
        errors.append(name)


def run_all_tests():
    global passed, failed, errors
    passed = 0
    failed = 0
    errors = []

    print("=" * 70)
    print("🚀 GhostRepro LIVE End-to-End Test Suite (No Mock Data)")
    print("=" * 70)

    # ─── 1. Health & Server Status ───────────────────────────────────────
    print("\n[1/18] Backend Health & System Status")
    health = req("/api/health")
    test("API health returns 'healthy'", health["status"] == "healthy")
    test("Health response has timestamp", "timestamp" in health)
    test("Health response has active_repo", "active_repo" in health)

    root = req("/")
    test("Root endpoint returns 'online'", root["status"] == "online")
    test("Root has project name", "GhostRepro" in root.get("project", ""))

    # ─── 2. GitHub User & Persistence ────────────────────────────────────
    print("\n[2/18] GitHub User Authentication & Persistence")
    user = req("/api/github/user")
    test("User endpoint returns data", "username" in user)
    test("User is authenticated", user.get("authenticated") is True)
    test("User has role", bool(user.get("role")))

    # ─── 3. Repository Management ────────────────────────────────────────
    print("\n[3/18] Repository Management & Selection")
    repos_data = req("/api/github/repos")
    test("Repos endpoint returns repositories", "repositories" in repos_data)
    test("At least one repository exists", len(repos_data["repositories"]) > 0)
    test("Active repo is set", bool(repos_data.get("active_repo")))

    # Add a custom repo
    add_res = req("/api/github/repos/add", method="POST", data={
        "name": "test-repo-live",
        "description": "Live test repository",
        "language": "Python",
    })
    test("Custom repo added successfully", add_res.get("status") == "added")
    test("Added repo has correct name", "test-repo-live" in add_res.get("repo", {}).get("full_name", ""))

    # ─── 4. Repository Selection ─────────────────────────────────────────
    print("\n[4/18] Repository Selection & Switching")
    repos_data = req("/api/github/repos")
    if len(repos_data["repositories"]) > 0:
        target = repos_data["repositories"][0]
        select_res = req("/api/github/repos/select", method="POST", data={"repo_id": target["id"]})
        test("Repo selection returns success", select_res.get("status") == "success")
        test("Active repo updated", bool(select_res.get("active_repo")))
    else:
        test("Repo selection (skipped, no repos)", False, "No repositories available")

    # ─── 5. GitHub Sync ──────────────────────────────────────────────────
    print("\n[5/18] GitHub Repository Sync")
    sync_res = req("/api/github/sync", method="POST")
    test("Sync returns status", sync_res.get("status") == "synced")
    test("Sync returns count", isinstance(sync_res.get("count"), int))
    test("Sync returns repositories list", isinstance(sync_res.get("repositories"), list))

    # ─── 6. PyPI Slopsquatting Scanner (Real Network) ────────────────────
    print("\n[6/18] PyPI Slopsquatting & Hallucination Detector (Real PyPI)")
    # Real hallucinated package
    bad_res = req("/api/slopsquat/scan", method="POST", data={"package": "reqeusts"})
    test("Typo 'reqeusts' detected as threat", bad_res.get("is_threat") is True)
    test("Typo has HALLUCINATED status", bad_res.get("status") in ("HALLUCINATED", "FLAGGED"))

    # Real legitimate package
    good_res = req("/api/slopsquat/scan", method="POST", data={"package": "requests"})
    test("'requests' is not a threat", good_res.get("is_threat") is False)
    test("'requests' has LEGITIMATE status", good_res.get("status") == "LEGITIMATE")
    test("'requests' has real version from PyPI", good_res.get("latest_version") is not None)

    # Another hallucinated package
    fake_res = req("/api/slopsquat/scan", method="POST", data={"package": "totally-fake-pkg-xyz123"})
    test("Nonexistent package flagged as threat", fake_res.get("is_threat") is True)

    # ─── 7. Slopsquatting Management ─────────────────────────────────────
    print("\n[7/18] Slopsquatting Threat Registry & Whitelist")
    slop_data = req("/api/dashboard/slopsquat")
    test("Slopsquat endpoint returns flagged list", "flagged" in slop_data)
    test("Slopsquat endpoint returns whitelisted list", "whitelisted" in slop_data)

    # Whitelist a package
    wl_res = req("/api/slopsquat/whitelist", method="POST", data={"package": "test-whitelist-pkg"})
    test("Whitelist returns success", wl_res.get("status") == "whitelisted")

    # Delete a flag
    del_res = req("/api/slopsquat/reqeusts", method="DELETE")
    test("Delete slopsquat flag returns success", del_res.get("status") == "deleted")

    # ─── 8. AST Blast Radius Analysis ────────────────────────────────────
    print("\n[8/18] AST Blast Radius & Scope Creep Calculator")
    code_base = "def calculate_price(qty, price):\n    return qty * price\n"
    code_mod = "def calculate_price(qty, price):\n    tax = 0.05\n    discount = 0.1\n    return (qty * price * (1 - discount)) * (1 + tax)\n"
    ast_res = req("/api/analyze/ast", method="POST", data={"original_code": code_base, "modified_code": code_mod})
    test("AST returns statement_delta", "statement_delta" in ast_res)
    test("AST delta is a real integer", isinstance(ast_res.get("statement_delta"), int))
    test("AST returns scope_creep_detected", "scope_creep_detected" in ast_res)

    # Test with syntax error
    ast_err = req("/api/analyze/ast", method="POST", data={"original_code": "def foo(:", "modified_code": "pass"})
    test("AST handles syntax errors gracefully", "error" in ast_err)

    # AST with added functions
    code_many = code_base + "\ndef helper_a(): pass\ndef helper_b(): pass\ndef helper_c(): pass\n"
    ast_big = req("/api/analyze/ast", method="POST", data={"original_code": code_base, "modified_code": code_many})
    test("AST detects added functions", ast_big.get("statement_delta", 0) > 0)

    # ─── 9. Bug Reproduction Synthesis ───────────────────────────────────
    print("\n[9/18] Autonomous Bug Reproduction Synthesizer (Groq LPU)")
    repro_res = req("/api/dashboard/issues/create", method="POST", data={
        "issue_number": 9999,
        "title": "Memory leak upon websocket drop",
        "description": "WebSocket connections are not cleaned up on disconnect",
    })
    test("Bug repro created successfully", repro_res.get("status") == "created")
    repro = repro_res.get("issue", {})
    test("Bug repro has correct issue number", repro.get("issue_number") == 9999)
    test("Bug repro starts in RED state", repro.get("repro_status") == "RED")
    test("Bug repro has test file name", "test_repro_9999" in repro.get("test_file", ""))
    test("Bug repro has synthesized code", bool(repro.get("code")))

    # ─── 10. Bug Reproduction Execution ──────────────────────────────────
    print("\n[10/18] Bug Reproduction Sandbox Execution")
    run_res = req("/api/dashboard/issues/9999/run", method="POST")
    test("Run returns success", run_res.get("status") == "success")
    test("Run returns correct issue number", run_res.get("issue_number") == 9999)
    test("Run flips status from RED to GREEN", run_res.get("repro_status") == "GREEN")

    # Run again to flip back
    run_res2 = req("/api/dashboard/issues/9999/run", method="POST")
    test("Second run flips back to RED", run_res2.get("repro_status") == "RED")

    # ─── 11. Bug Reproduction Code Retrieval ─────────────────────────────
    print("\n[11/18] Bug Reproduction Code Retrieval")
    code_res = req("/api/dashboard/issues/9999/code")
    test("Code retrieval returns issue number", code_res.get("issue_number") == 9999)
    test("Code retrieval has test file", "test_repro_9999" in code_res.get("test_file", ""))
    test("Code contains actual Python code", "def " in code_res.get("code", "") or "import" in code_res.get("code", ""))

    # ─── 12. Issues List ─────────────────────────────────────────────────
    print("\n[12/18] Issues & Reproductions List")
    issues_res = req("/api/dashboard/issues")
    test("Issues endpoint returns list", "issues" in issues_res)
    test("Our created issue #9999 is in the list", any(i.get("issue_number") == 9999 for i in issues_res.get("issues", [])))

    # Run on nonexistent issue should 404
    missing_run = req("/api/dashboard/issues/88888/run", method="POST", expect_error=True)
    test("Running nonexistent issue returns 404", missing_run.get("_http_status") == 404)

    # ─── 13. PR Fetching from Real GitHub ────────────────────────────────
    print("\n[13/18] PR Fetching from Real GitHub API")
    # Test with a well-known repo that always has PRs
    pr_res = req("/api/dashboard/prs/simulate", method="POST", data={"repo": "microsoft/vscode"}, expect_error=True)
    if pr_res.get("_http_status"):
        # Rate limited or auth error — the backend properly returned an error, not fake data
        test("PR fetch returns real error (not mock data)", pr_res.get("_http_status") in (401, 403, 404, 502, 429))
        test("PR error has descriptive detail", bool(pr_res.get("detail")))
    else:
        # Successful real fetch
        test("PR fetch returns real status", pr_res.get("status") in ("ingested", "no_new"))
        if pr_res.get("status") == "ingested":
            test("Ingested PRs are real GitHub data", isinstance(pr_res.get("prs"), list))
            first_pr = pr_res["prs"][0] if pr_res.get("prs") else {}
            test("Real PR has title from GitHub", bool(first_pr.get("title")))
            test("Real PR has author from GitHub", bool(first_pr.get("author")))
        else:
            test("All PRs already ingested", "already" in pr_res.get("message", "").lower())

    # Test with invalid repo
    bad_repo = req("/api/dashboard/prs/simulate", method="POST", data={"repo": "nonexistent/fakerepo99999"}, expect_error=True)
    test("Invalid repo returns error (not mock data)", bad_repo.get("_http_status") in (401, 403, 404, 502, 429))

    # Test with no repo
    no_repo = req("/api/dashboard/prs/simulate", method="POST", data={"repo": ""}, expect_error=True)
    test("Empty repo returns 400 error", no_repo.get("_http_status") == 400)

    # ─── 14. Dashboard Metrics & PR List ─────────────────────────────────
    print("\n[14/18] Dashboard Metrics & PR List")
    metrics = req("/api/dashboard/metrics")
    test("Metrics has total_prs_reviewed", "total_prs_reviewed" in metrics)
    test("Metrics has prs_passed", "prs_passed" in metrics)
    test("Metrics has prs_quarantined", "prs_quarantined" in metrics)
    test("Metrics has issues_reproduced", "issues_reproduced" in metrics)
    test("Metrics values are integers", all(isinstance(v, int) for v in metrics.values()))

    prs_list = req("/api/dashboard/prs")
    test("PR list returns pull_requests key", "pull_requests" in prs_list)
    test("PR list is an array", isinstance(prs_list["pull_requests"], list))

    quarantine = req("/api/dashboard/quarantine")
    test("Quarantine returns queue", "queue" in quarantine)
    test("Quarantine returns count", "count" in quarantine)

    pipeline = req("/api/dashboard/pipeline")
    test("Pipeline returns events", "events" in pipeline)

    # PR merge & incorporation endpoint check
    merge_check = req("/api/dashboard/prs/merge", method="POST", data={"repo": "invalid-repo", "pr_number": -1}, expect_error=True)
    test("PR merge endpoint returns response dictionary", isinstance(merge_check, dict))
    test("PR merge validates invalid repo/pr number", merge_check.get("success") is False or "Invalid" in merge_check.get("message", ""))

    # ─── 15. Configuration CRUD ──────────────────────────────────────────
    print("\n[15/18] Configuration Read & Update")
    config = req("/api/config")
    test("Config has verification_rules", "verification_rules" in config)
    test("Config has model_config", "model_config" in config)
    test("Config has repo_settings", "repo_settings" in config)
    test("Verification rules has min_trust_score", "min_trust_score" in config.get("verification_rules", {}))
    test("Model config has model_name", "model_name" in config.get("model_config", {}))

    # Update config
    update_res = req("/api/config", method="POST", data={
        "verification_rules": {"min_trust_score": 90},
    })
    test("Config update returns 'updated'", update_res.get("status") == "updated")
    test("Updated trust score is 90", update_res.get("config", {}).get("verification_rules", {}).get("min_trust_score") == 90)

    # Restore to original
    req("/api/config", method="POST", data={"verification_rules": {"min_trust_score": 80}})

    # ─── 16. Webhook Ping ────────────────────────────────────────────────
    print("\n[16/18] Webhook Ping & Pipeline Events")
    wh = req("/api/config/ping-webhook", method="POST")
    test("Webhook ping returns 'pong'", wh.get("status") == "pong")
    test("Webhook event has message", bool(wh.get("event", {}).get("message")))
    test("Webhook event has timestamp", bool(wh.get("event", {}).get("timestamp")))

    # ─── 17. Execution Logs Lifecycle ────────────────────────────────────
    print("\n[17/18] Execution Logs & Sandbox Suite")
    logs = req("/api/dashboard/logs")
    test("Logs endpoint returns logs list", "logs" in logs)
    test("Logs have entries from previous operations", logs.get("count", 0) > 0)

    # Trigger sandbox suite
    sandbox_res = req("/api/sandbox/trigger-test", method="POST", data={"suite": "regression", "pr_id": "test-pr"})
    test("Sandbox suite returns completed", sandbox_res.get("status") == "completed")
    test("Sandbox exit code is 0", sandbox_res.get("exit_code") == 0)

    # Verify logs increased
    logs_after = req("/api/dashboard/logs")
    test("Logs count increased after sandbox run", logs_after.get("count", 0) > logs.get("count", 0))

    # Clear logs
    clear_res = req("/api/dashboard/logs", method="DELETE")
    test("Clear logs returns 'cleared'", clear_res.get("status") == "cleared")

    logs_empty = req("/api/dashboard/logs")
    test("Logs are empty after clearing", logs_empty.get("count", 0) == 0)

    # ─── 18. SQLite Database Integrity ───────────────────────────────────
    print("\n[18/18] SQLite Database Physical Integrity")
    db_path = os.path.abspath(os.path.join("backend", "data", "ghostrepro.db"))
    test("Database file exists", os.path.exists(db_path), f"Expected at {db_path}")

    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Verify all expected tables exist
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cur.fetchall()}
        expected_tables = {"users", "repositories", "pull_requests", "bug_reproductions",
                           "slop_flags", "package_whitelist", "execution_logs",
                           "pipeline_events", "configuration"}
        for t in expected_tables:
            test(f"Table '{t}' exists in database", t in tables)

        # Verify user data
        cur.execute("SELECT username, role FROM users")
        users = cur.fetchall()
        test("Users table has entries", len(users) > 0)

        # Verify repository data
        cur.execute("SELECT full_name, is_active FROM repositories")
        repos = cur.fetchall()
        test("Repositories table has entries", len(repos) > 0)

        # Verify bug repro data (from test #9)
        cur.execute("SELECT issue_number, repro_status FROM bug_reproductions WHERE issue_number = 9999")
        repro_row = cur.fetchone()
        test("Bug repro #9999 persisted to database", repro_row is not None)

        conn.close()
    else:
        test("Database integrity check (skipped)", False, "Database file not found")

    # ─── Final Reset ─────────────────────────────────────────────────────
    print("\n[CLEANUP] Resetting dashboard state")
    reset_res = req("/api/dashboard/reset", method="POST")
    test("Dashboard reset returns 'cleared'", reset_res.get("status") == "cleared")

    # ─── Results Summary ─────────────────────────────────────────────────
    total = passed + failed
    print("\n" + "=" * 70)
    if failed == 0:
        print(f"🎉 ALL {total} LIVE END-TO-END TESTS PASSED! (0 failures)")
    else:
        print(f"⚠️  {passed}/{total} tests passed, {failed} FAILED")
        print("Failed tests:")
        for e in errors:
            print(f"  - {e}")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test suite crashed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
