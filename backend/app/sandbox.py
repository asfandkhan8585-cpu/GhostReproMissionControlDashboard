import subprocess


def run_pytest_sandbox(test_file_path: str) -> dict:
    """Docker/Subprocess Pytest execution runner.

    Runs pytest against the given test file in a sandboxed subprocess
    with a strict 10-second timeout.
    """
    try:
        result = subprocess.run(
            ["pytest", test_file_path, "--tb=short"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return {
            "exit_code": result.returncode,
            "passed": result.returncode == 0,
            "output": result.stdout + result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"exit_code": -1, "passed": False, "output": "Execution timed out."}
    except Exception as e:
        return {"exit_code": -1, "passed": False, "output": str(e)}
