"""GhostRepro Embedded SQLite Database Layer.

Provides zero-dependency, persistent storage for:
- Maintainer profile & authorized GitHub credentials
- Monitored repositories and active workspace selection
- Pull request clearance records, trust scores & AST metrics
- Autonomous bug reproduction proofs & pytest code
- Slopsquatting threat registry & maintainer whitelist
- Security policies, LLM configurations, and execution audit logs
"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime, timezone

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "ghostrepro.db"


def get_connection():
    """Returns a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables for all GhostRepro data entities."""
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
            test_result_json TEXT,
            pipeline_stage TEXT DEFAULT 'QUARANTINE_EVAL',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Bug Reproductions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bug_reproductions (
            issue_number INTEGER PRIMARY KEY,
            repo TEXT,
            title TEXT,
            repro_status TEXT DEFAULT 'RED',
            test_file TEXT,
            code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        
        conn.commit()


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
        conn.commit()


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
        conn.commit()


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
        conn.commit()


def save_bug_repro(repro: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO bug_reproductions (issue_number, repo, title, repro_status, test_file, code)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(issue_number) DO UPDATE SET
            repo=excluded.repo,
            title=excluded.title,
            repro_status=excluded.repro_status,
            test_file=excluded.test_file,
            code=excluded.code
        """, (
            repro.get("issue_number"),
            repro.get("repo", ""),
            repro.get("title", ""),
            repro.get("repro_status", "RED"),
            repro.get("test_file", ""),
            repro.get("code", "")
        ))
        conn.commit()


def get_all_bug_repros() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM bug_reproductions ORDER BY issue_number DESC").fetchall()
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
        conn.commit()


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
        conn.commit()


def get_config(section: str) -> dict | None:
    with get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT config_json FROM configuration WHERE section = ?", (section,)).fetchone()
        if row and row["config_json"]:
            return json.loads(row["config_json"])
    return None
