import requests

TRUSTED_MAINTAINERS = {"your_github_username"}
APPROVED_CONTRIBUTORS = {"trusted_dev_alice", "oss_contributor_bob"}

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
    for line in requirements_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        pkg_name = line.split("==")[0].split(">=")[0].split("<=")[0].strip()
        response = requests.get(f"https://pypi.org/pypi/{pkg_name}/json")
        if response.status_code != 200:
            flagged_packages.append({
                "package": pkg_name,
                "reason": "Hallucinated Package (Does not exist on PyPI!)"
            })
        else:
            data = response.json()
            if not data.get("releases"):
                flagged_packages.append({
                    "package": pkg_name,
                    "reason": "No valid releases found on PyPI."
                })
    return flagged_packages
