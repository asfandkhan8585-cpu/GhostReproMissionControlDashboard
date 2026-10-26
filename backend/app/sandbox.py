import os
import sys
import subprocess
from pathlib import Path

# Restrict execution to the workspace / project tree
ALLOWED_ROOTS = [
    Path(__file__).resolve().parent.parent,          # backend/
    Path(__file__).resolve().parent.parent.parent,   # workspace root
]

SENSITIVE_ENV_KEYS = {
    "GROQ_API_KEY",
    "GITHUB_TOKEN",
    "VITE_GITHUB_TOKEN",
    "WEBHOOK_SECRET",
    "AWS_SECRET_ACCESS_KEY",
    "DATABASE_URL",
    "SECRET_KEY",
}


def sanitize_sandbox_env() -> dict:
    """Creates a stripped, secure environment dictionary for subprocess execution."""
    safe_env = {}
    for key, value in os.environ.items():
        if key.upper() in SENSITIVE_ENV_KEYS:
            continue
        if "TOKEN" in key.upper() or "SECRET" in key.upper() or "KEY" in key.upper():
            continue
        safe_env[key] = value

    # Ensure required system execution variables exist
    safe_env["PYTHONDONTWRITEBYTECODE"] = "1"
    safe_env["PYTHONUNBUFFERED"] = "1"
    return safe_env


def is_path_within_allowed_roots(target: Path) -> bool:
    """Verifies that the target path does not escape sandbox directory boundaries."""
    try:
        resolved = target.resolve()
        for root in ALLOWED_ROOTS:
            resolved_root = root.resolve()
            if resolved == resolved_root or resolved_root in resolved.parents:
                return True
    except Exception:
        return False
    return False


def run_pytest_sandbox(test_file_path: str) -> dict:
    """Sanitized and confined Pytest sandbox execution runner.

    Executes pytest against the specified test file in a secured subprocess
    with an isolated environment (no leaked API keys/tokens), strict path
    boundary validation, and a 10-second timeout.
    """
    if not test_file_path or not isinstance(test_file_path, str):
        return {"exit_code": 1, "passed": False, "output": "Invalid test file path provided."}

    path_obj = Path(test_file_path)

    # 1. Enforce .py extension
    if path_obj.suffix.lower() != ".py":
        return {
            "exit_code": 1,
            "passed": False,
            "output": f"Security violation: Target '{test_file_path}' is not a Python (.py) file."
        }

    # 2. Check path containment (prevent directory traversal / arbitrary file read)
    if not is_path_within_allowed_roots(path_obj):
        return {
            "exit_code": 1,
            "passed": False,
            "output": f"Security violation: Path '{test_file_path}' is outside allowed repository sandbox boundary."
        }

    resolved = path_obj.resolve()
    if not resolved.exists() or not resolved.is_file():
        return {
            "exit_code": 1,
            "passed": False,
            "output": f"Error: Test file '{test_file_path}' does not exist on disk."
        }

    # 3. Sanitize environment
    clean_env = sanitize_sandbox_env()

    # 4. Execute with sys.executable -m pytest
    cmd = [sys.executable, "-m", "pytest", str(resolved), "--tb=short", "-v"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            env=clean_env,
            cwd=str(ALLOWED_ROOTS[1]),
        )
        output = (result.stdout + "\n" + result.stderr).strip()
        return {
            "exit_code": result.returncode,
            "passed": result.returncode == 0,
            "output": output,
        }
    except subprocess.TimeoutExpired:
        return {
            "exit_code": -1,
            "passed": False,
            "output": "Execution timed out (10s sandbox limit exceeded)."
        }
    except Exception as e:
        return {
            "exit_code": -1,
            "passed": False,
            "output": f"Sandbox subprocess error: {str(e)}"
        }

