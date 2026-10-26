"""GhostRepro Embedded SQLite Database Layer.

Provides zero-dependency, persistent storage for:
- Maintainer profile & authorized GitHub credentials
- Monitored repositories and active workspace selection
- Pull request clearance records, trust scores & AST metrics
- Autonomous bug reproduction proofs & pytest code (keyed by repo + issue_number)
- Slopsquatting threat registry & maintainer whitelist
- Security policies, LLM configurations, and execution audit logs
"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "ghostrepro.db"


@contextmanager
def get_connection():
    """Context manager for SQLite database connection.
    
    Guarantees that transactions are committed on clean exit and that
    the connection is ALWAYS properly closed, preventing descriptor leaks.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initializes tables and migrations for all GhostRepro data entities."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # User & Credentials
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            name TEXT,
            avatar_url TEXT,
            company TEXT,
            public_repos INTEGER DEFAULT 0,
            role TEXT DEFAULT 'MAINTAINER',
            authenticated INTEGER DEFAULT 1,
            pat_hash TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Repositories
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            full_name TEXT UNIQUE,
            name TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 0,
            is_private INTEGER DEFAULT 0,
            stars INTEGER DEFAULT 0,
            forks INTEGER DEFAULT 0,
            open_prs INTEGER DEFAULT 0,
            quarantined_prs INTEGER DEFAULT 0,
            repro_tests INTEGER DEFAULT 0,
            language TEXT DEFAULT 'Python',
            default_branch TEXT DEFAULT 'main',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Pull Requests
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS pull_requests (
            id TEXT PRIMARY KEY,
            number INTEGER,
            repo TEXT,
            title TEXT,
            author TEXT,
            author_avatar TEXT,
            author_association TEXT,
            trust_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'QUARANTINED',
            tier TEXT DEFAULT 'QUARANTINE_QUEUE',
            blast_radius_json TEXT,
            dependencies_json TEXT,
            test_result_json TEXT,
            pipeline_stage TEXT DEFAULT 'QUARANTINE_EVAL',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Check bug_reproductions schema: ensure composite primary key (repo, issue_number)
        cursor.execute("PRAGMA table_info(bug_reproductions)")
        cols = cursor.fetchall()
        pk_cols = [c["name"] for c in cols if c["pk"] > 0]
        if cols and pk_cols == ["issue_number"]:
            # Migrate legacy table with single primary key to composite primary key
            cursor.execute("ALTER TABLE bug_reproductions RENAME TO bug_reproductions_old")
            cursor.execute("""
            CREATE TABLE bug_reproductions (
                issue_number INTEGER,
                repo TEXT,
                title TEXT,
                repro_status TEXT DEFAULT 'RED',
                test_file TEXT,
                code TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (repo, issue_number)
            )
            """)
            cursor.execute("""
            INSERT OR IGNORE INTO bug_reproductions (issue_number, repo, title, repro_status, test_file, code, created_at)
            SELECT issue_number, COALESCE(repo, ''), title, repro_status, test_file, code, created_at FROM bug_reproductions_old
            """)
            cursor.execute("DROP TABLE bug_reproductions_old")
        else:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS bug_reproductions (
                issue_number INTEGER,
                repo TEXT,
                title TEXT,
                repro_status TEXT DEFAULT 'RED',
                test_file TEXT,
                code TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (repo, issue_number)
            )
            """)
        
        # Slopsquatting Threats & Whitelist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS slop_flags (
            package TEXT PRIMARY KEY,
            reason TEXT,
            pr_id TEXT,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS package_whitelist (
            package TEXT PRIMARY KEY,
            whitelisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Pipeline Events & Execution Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            stage TEXT,
            level TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_events (
            id TEXT PRIMARY KEY,
            pr_id TEXT,
            stage TEXT,
            status TEXT,
            timestamp TEXT,
            message TEXT
        )
        """)
        
        # Configuration
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS configuration (
            section TEXT PRIMARY KEY,
            config_json TEXT
        )
        """)


# Initialize database on module load
init_db()


# ─── Data Access Helpers ──────────────────────────────────────────────────────

def save_user(user_data: dict, pat: str = ""):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO users (username, name, avatar_url, company, public_repos, role, authenticated, pat_hash)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(username) DO UPDATE SET
            name=excluded.name,
            avatar_url=excluded.avatar_url,
            company=excluded.company,
            public_repos=excluded.public_repos,
            role=excluded.role,
            authenticated=1,
            pat_hash=excluded.pat_hash,
            updated_at=CURRENT_TIMESTAMP
        """, (
            user_data.get("username", "anonymous"),
            user_data.get("name", ""),
            user_data.get("avatar_url", ""),
            user_data.get("company", ""),
            user_data.get("public_repos", 0),
            user_data.get("role", "MAINTAINER"),
            pat[:8] + "..." if pat else ""
        ))


def get_latest_user() -> dict | None:
    with get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM users ORDER BY updated_at DESC LIMIT 1").fetchone()
        if row:
            return dict(row)
    return None


def save_repository(repo: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO repositories (id, full_name, name, description, is_active, is_private, stars, forks, open_prs, quarantined_prs, repro_tests, language, default_branch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(full_name) DO UPDATE SET
            description=excluded.description,
            is_active=excluded.is_active,
            stars=excluded.stars,
            forks=excluded.forks,
            open_prs=excluded.open_prs,
            quarantined_prs=excluded.quarantined_prs,
            repro_tests=excluded.repro_tests
        """, (
            repo.get("id", repo.get("full_name")),
            repo.get("full_name"),
            repo.get("name"),
            repo.get("description", ""),
            1 if repo.get("is_active") else 0,
            1 if repo.get("is_private") else 0,
            repo.get("stars", 0),
            repo.get("forks", 0),
            repo.get("open_prs", 0),
            repo.get("quarantined_prs", 0),
            repo.get("repro_tests", 0),
            repo.get("language", "Python"),
            repo.get("default_branch", "main"),
        ))


def get_all_repositories() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM repositories ORDER BY stars DESC").fetchall()
        return [dict(r) for r in rows]


def set_active_repository(full_name: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE repositories SET is_active = 0")
        cursor.execute("UPDATE repositories SET is_active = 1 WHERE full_name = ?", (full_name,))


def save_pull_request(pr: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        blast_json = json.dumps(pr.get("blast_radius")) if pr.get("blast_radius") else None
        deps_json = json.dumps(pr.get("dependencies")) if pr.get("dependencies") else None
        test_json = json.dumps(pr.get("test_result")) if pr.get("test_result") else None
        cursor.execute("""
        INSERT INTO pull_requests (id, number, repo, title, author, author_avatar, author_association, trust_score, status, tier, blast_radius_json, dependencies_json, test_result_json, pipeline_stage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            number=excluded.number,
            repo=excluded.repo,
            title=excluded.title,
            trust_score=excluded.trust_score,
            status=excluded.status,
            tier=excluded.tier,
            blast_radius_json=excluded.blast_radius_json,
            dependencies_json=excluded.dependencies_json,
            test_result_json=excluded.test_result_json,
            pipeline_stage=excluded.pipeline_stage
        """, (
            pr.get("id"),
            pr.get("number", 0),
            pr.get("repo", ""),
            pr.get("title", ""),
            pr.get("author", ""),
            pr.get("author_avatar", ""),
            pr.get("author_association", "NONE"),
            pr.get("trust_score", 0),
            pr.get("status", "QUARANTINED"),
            pr.get("tier", "QUARANTINE_QUEUE"),
            blast_json,
            deps_json,
            test_json,
            pr.get("pipeline_stage", "QUARANTINE_EVAL"),
            pr.get("created_at", datetime.now(timezone.utc).isoformat())
        ))


def get_all_pull_requests(repo: str = None) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if repo:
            rows = cursor.execute("SELECT * FROM pull_requests WHERE repo = ? ORDER BY created_at DESC", (repo,)).fetchall()
        else:
            rows = cursor.execute("SELECT * FROM pull_requests ORDER BY created_at DESC").fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["blast_radius"] = json.loads(d["blast_radius_json"]) if d.get("blast_radius_json") else None
            d["dependencies"] = json.loads(d["dependencies_json"]) if d.get("dependencies_json") else []
            d["test_result"] = json.loads(d["test_result_json"]) if d.get("test_result_json") else None
            results.append(d)
        return results


def save_bug_repro(repro: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        repo = repro.get("repo", "")
        cursor.execute("""
        INSERT INTO bug_reproductions (issue_number, repo, title, repro_status, test_file, code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(repo, issue_number) DO UPDATE SET
            title=excluded.title,
            repro_status=excluded.repro_status,
            test_file=excluded.test_file,
            code=excluded.code
        """, (
            repro.get("issue_number"),
            repo,
            repro.get("title", ""),
            repro.get("repro_status", "RED"),
            repro.get("test_file", ""),
            repro.get("code", ""),
            repro.get("created_at", datetime.now(timezone.utc).isoformat())
        ))


def get_all_bug_repros(repo: str = None) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if repo:
            rows = cursor.execute("SELECT * FROM bug_reproductions WHERE repo = ? ORDER BY issue_number DESC", (repo,)).fetchall()
        else:
            rows = cursor.execute("SELECT * FROM bug_reproductions ORDER BY issue_number DESC").fetchall()
        return [dict(r) for r in rows]


def save_slop_flag(flag: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO slop_flags (package, reason, pr_id, detected_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(package) DO UPDATE SET
            reason=excluded.reason,
            pr_id=excluded.pr_id,
            detected_at=excluded.detected_at
        """, (
            flag.get("package", "").lower(),
            flag.get("reason", ""),
            flag.get("pr_id", "live-scan"),
            flag.get("detected_at", datetime.now(timezone.utc).isoformat())
        ))


def get_all_slop_flags() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM slop_flags ORDER BY detected_at DESC").fetchall()
        return [dict(r) for r in rows]


def delete_slop_flag(package: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM slop_flags WHERE package = ?", (package.lower(),))


def add_to_whitelist(package: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO package_whitelist (package)
        VALUES (?)
        ON CONFLICT(package) DO NOTHING
        """, (package.lower(),))


def get_whitelist() -> list[str]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT package FROM package_whitelist ORDER BY package ASC").fetchall()
        return [r["package"] for r in rows]


def remove_from_whitelist(package: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM package_whitelist WHERE package = ?", (package.lower(),))


def save_pipeline_event(evt: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO pipeline_events (id, pr_id, stage, status, timestamp, message)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """, (
            evt.get("id"),
            evt.get("pr_id", ""),
            evt.get("stage", ""),
            evt.get("status", "passed"),
            evt.get("timestamp", datetime.now(timezone.utc).isoformat()),
            evt.get("message", "")
        ))


def get_pipeline_events(limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM pipeline_events ORDER BY rowid DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]


def save_log(log_item: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO execution_logs (id, timestamp, stage, level, message)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """, (
            log_item.get("id"),
            log_item.get("timestamp"),
            log_item.get("stage"),
            log_item.get("level"),
            log_item.get("message")
        ))


def get_recent_logs(limit: int = 100) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]


def save_config(section: str, data: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO configuration (section, config_json)
        VALUES (?, ?)
        ON CONFLICT(section) DO UPDATE SET config_json=excluded.config_json
        """, (section, json.dumps(data)))


def get_config(section: str) -> dict | None:
    with get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT config_json FROM configuration WHERE section = ?", (section,)).fetchone()
        if row and row["config_json"]:
            return json.loads(row["config_json"])
    return None


def get_full_config() -> dict | None:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT section, config_json FROM configuration").fetchall()
        if not rows:
            return None
        res = {}
        for r in rows:
            if r["config_json"]:
                res[r["section"]] = json.loads(r["config_json"])
        return res


def clear_all_logs():
    """Removes all stored logs from execution_logs table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM execution_logs")


def clear_transient_tables():
    """Purges transient demo/runtime state from database while preserving users and repositories."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pull_requests")
        cursor.execute("DELETE FROM pipeline_events")
        cursor.execute("DELETE FROM slop_flags")
        cursor.execute("DELETE FROM package_whitelist")
        cursor.execute("DELETE FROM bug_reproductions")
        cursor.execute("DELETE FROM execution_logs")

