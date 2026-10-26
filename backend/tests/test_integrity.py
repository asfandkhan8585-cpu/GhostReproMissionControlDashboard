import importlib
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

@pytest.fixture
def api(tmp_path, monkeypatch):
    from app import database
    monkeypatch.setattr(database, 'DB_PATH', tmp_path / 'test.sqlite')
    monkeypatch.setenv('WEBHOOK_SECRET', '')
    database.init_db()
    from app import main
    main = importlib.reload(main)
    return main, TestClient(main.app)

def test_mutations_require_auth(api):
    _, client = api
    for route in ['/api/dashboard/reset', '/api/sandbox/run', '/api/dashboard/prs/merge', '/api/config']:
        assert client.post(route, json={}).status_code == 401

def test_unsigned_webhook_fails_closed(api):
    _, client = api
    assert client.post('/webhook', json={}, headers={'X-GitHub-Event': 'ping'}).status_code == 503

def test_malformed_ai_verdict_rejected(monkeypatch):
    from app import llm_agent
    monkeypatch.setattr(llm_agent, 'query_groq', lambda *a, **kw: 'Looks fine to me')
    assert llm_agent.run_adversarial_fuzzing_evaluation('pr-1', 'diff')['status'] == 'error'

def test_llm_review_does_not_claim_executed_mutations(monkeypatch):
    from app import llm_agent
    monkeypatch.setattr(llm_agent, 'query_groq', lambda *a, **kw: 'STATUS: PASSED\nCHEATS_DETECTED: 0\nANALYSIS: No issue identified.')
    result = llm_agent.run_adversarial_fuzzing_evaluation('pr-1', 'diff')
    assert result['status'] == 'passed'
    assert result['mutations'] == 0

def test_missing_verification_blocks_github(api, monkeypatch):
    main, _ = api
    monkeypatch.setenv('GITHUB_TOKEN', 'test-fixture-token')
    result = main.execute_github_pr_incorporation('owner/repo', 1)
    assert result['success'] is False
    assert 'verification' in result['message'].lower()


def test_authorization_requires_token_proof(api, monkeypatch):
    _, client = api
    monkeypatch.setenv("GITHUB_TOKEN", "test-only-environment-credential")
    assert client.post("/api/github/authorize", json={"username": "owner"}).status_code == 401

def test_changed_head_blocks_merge(api, monkeypatch):
    main, _ = api
    monkeypatch.setattr(main, "get_all_pull_requests", lambda: [{"repo": "owner/repo", "number": 1, "test_result": {"passed": True, "head_sha": "old", "llm_review": "passed"}}])
    monkeypatch.setattr(main, "get_effective_github_token", lambda *a: "test-token")
    class ChangedHead:
        status_code = 200
        def json(self): return {"head": {"sha": "new"}}
    monkeypatch.setattr(main.requests, "get", lambda *a, **kw: ChangedHead())
    monkeypatch.setattr(main.requests, "post", lambda *a, **kw: pytest.fail("Must not approve changed head"))
    assert "head changed" in main.execute_github_pr_incorporation("owner/repo", 1)["message"]

def test_repo_issue_collision(api, monkeypatch):
    main, _ = api
    main._issue_repros = [{"repo": "a/repo", "issue_number": 1, "code": "a"}, {"repo": "b/repo", "issue_number": 1, "code": "b"}]
    main._active_repo = "b/repo"
    assert main.get_issue_repro_code(1)["code"] == "b"
