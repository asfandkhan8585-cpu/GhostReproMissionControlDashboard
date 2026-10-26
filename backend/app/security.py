import re
import requests

TRUSTED_MAINTAINERS = {"your_github_username"}
APPROVED_CONTRIBUTORS = {"trusted_dev_alice", "oss_contributor_bob"}

PACKAGE_NAME_REGEX = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$")

def extract_package_name(raw_line: str) -> str | None:
    """Extracts a valid Python package name from a requirements line or diff hunk.
    
    Correctly handles:
    - Diff prefixes (+, but not diff headers +++, ---, @@)
    - Inline comments (#...)
    - Environment markers (; python_version < '3.11')
    - Extras (requests[security])
    - Version specifiers (==, ~=, >=, <=, !=, <, >, ===)
    - TOML/config lines (ignores section headers [...] and non-package keys)
    """
    line = raw_line.strip()
    if not line:
        return None

    # Ignore diff metadata headers
    if line.startswith(("+++", "---", "@@", "diff ", "index ")):
        return None

    # Strip diff '+' addition marker if present
    if line.startswith("+"):
        line = line[1:].strip()

    # Ignore comments and empty lines
    if not line or line.startswith("#"):
        return None

    # Ignore TOML section headers like [tool.poetry] or [[tool.poetry.source]]
    if line.startswith("[") and line.endswith("]"):
        return None

    # Ignore TOML key-values that are clearly configuration
    if "=" in line and ("{" in line or '"^' in line or "'" in line):
        # Could be poetry format: pkg = "^1.0" or pkg = { version = "1.0" }
        candidate = line.split("=")[0].strip().strip('"').strip("'")
        if PACKAGE_NAME_REGEX.match(candidate) and candidate.lower() not in {"python", "name", "version", "description", "authors", "readme"}:
            return candidate.lower()
        return None

    # Strip inline comments
    line = line.split("#")[0].strip()

    # Strip environment markers (PEP 508) e.g. importlib-metadata; python_version < '3.8'
    line = line.split(";")[0].strip()

    # Strip URL/VCS specifications
    line = line.split("@")[0].strip()

    # Strip version specifiers: ~=, ==, >=, <=, !=, ===, >, <
    line = re.split(r"(?:~=|==|>=|<=|!=|===|>|<)", line)[0].strip()

    # Strip extras e.g. requests[security] -> requests
    line = re.sub(r"\[.*?\]", "", line).strip()

    # Validate against official PEP 508 naming regex
    if PACKAGE_NAME_REGEX.match(line):
        return line.lower()

    return None

def check_user_clearance(username: str, author_association: str) -> dict:
    """Role-based user filter: determines trust tier for PR authors."""
    if username in TRUSTED_MAINTAINERS or author_association in ["OWNER", "MEMBER"]:
        return {"status": "APPROVED", "tier": "VIP Fast-Track"}

    if username in APPROVED_CONTRIBUTORS or author_association == "CONTRIBUTOR":
        return {"status": "APPROVED", "tier": "Verified Contributor"}

    return {
        "status": "QUARANTINED",
        "tier": "Untrusted / First-Time",
        "message": f"@{username} is quarantined. Maintainer authorization required."
    }

def scan_pypi_dependencies(requirements_text: str) -> list:
    """PyPI Slopsquatting scanner: flags packages that don't exist or have no releases."""
    flagged_packages = []
    seen = set()
    for line in requirements_text.splitlines():
        pkg_name = extract_package_name(line)
        if not pkg_name or pkg_name in seen:
            continue
        seen.add(pkg_name)
        
        try:
            response = requests.get(f"https://pypi.org/pypi/{pkg_name}/json", timeout=5)
            if response.status_code == 404:
                flagged_packages.append({
                    "package": pkg_name,
                    "reason": "Hallucinated Package (Does not exist on PyPI!)"
                })
            elif response.status_code == 200:
                data = response.json()
                if not data.get("releases"):
                    flagged_packages.append({
                        "package": pkg_name,
                        "reason": "No valid releases found on PyPI."
                    })
        except requests.RequestException as e:
            flagged_packages.append({
                "package": pkg_name,
                "reason": f"PyPI verification request error: {str(e)}"
            })
    return flagged_packages
