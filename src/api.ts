/**
 * GhostRepro API Client
 *
 * Centralized typed client for GhostRepro Mission Control.
 * Synchronizes with FastAPI backend running at http://localhost:8000.
 * Follows the Zero-Mock rule: all telemetry, reproduction proofs, AST metrics,
 * and security flags are computed by the backend; failure states are surfaced honestly.
 */

const API_BASE = 'http://localhost:8000'

export const GROQ_MODEL = 'llama-3.3-70b-versatile'

export const GHOSTREPRO_REPRO_PROMPT = `You are GhostRepro Autonomous Reproduction Engine, the core AI agent of the GhostRepro Zero-Trust Gatekeeper.
Your job is to generate a standalone, mathematically rigorous pytest test file (test_repro_{issue_number}.py) that reproduces the bug described in the user's issue.
RULES:
1. The test MUST initially FAIL (RED) when executed, establishing mathematical proof of the bug.
2. Assert the precise edge-case or failure mode specified in the issue.
3. Write production-grade, syntactically valid Python 3 code with clear assertions and failure messages.
4. Return ONLY executable Python code.`

/* ─── Type Definitions ──────────────────────────────────────────────── */

export type DashboardMetrics = {
  total_prs_reviewed: number
  prs_passed: number
  prs_rejected: number
  prs_quarantined: number
  issues_reproduced: number
  active_red_tests: number
  slopsquat_packages_blocked: number
  pipeline_events_24h: number
}

export type PRRecord = {
  id: string
  number: number
  repo: string
  title: string
  author: string
  author_avatar: string
  author_association: string
  trust_score: number
  status: 'PASSED' | 'REJECTED' | 'QUARANTINED' | 'RUNNING' | 'FAILED'
  tier: string
  blast_radius: { statement_delta: number; scope_creep_detected: boolean } | null
  test_result: { passed: boolean; exit_code: number; output?: string } | null
  created_at: string
  pipeline_stage: string
}

export type PipelineEvent = {
  id: string
  pr_id: string
  stage: string
  status: 'passed' | 'failed'
  timestamp: string
  message: string
}

export type IssueRepro = {
  issue_number: number
  repo: string
  title: string
  repro_status: 'RED' | 'GREEN'
  test_file: string
  created_at: string
}

export type SlopsquatFlag = {
  package: string
  reason: string
  pr_id: string
  detected_at: string
}

export type GitHubUser = {
  authenticated: boolean
  username: string
  name: string
  avatar_url: string
  company: string
  public_repos: number
  role: string
}

export type GitHubRepo = {
  id: string
  full_name: string
  name: string
  description: string
  is_active: boolean
  is_private: boolean
  stars: number
  forks: number
  open_prs: number
  quarantined_prs: number
  repro_tests: number
  language: string
  default_branch: string
}

export type VerificationRules = {
  min_trust_score: number
  auto_quarantine_first_timers: boolean
  blast_radius_threshold: number
  block_slopsquatting: boolean
  fuzzing_mutation_count: number
  strict_mode: boolean
}

export type ModelConfig = {
  model_name: string
  provider: string
  inference_endpoint: string
  temperature: number
  context_window: string
  api_key: string
}

export type RepoSettings = {
  webhook_url: string
  webhook_secret: string
  auto_merge_on_pass: boolean
  sandbox_timeout_sec: number
  quarantine_unverified_bots: boolean
}

export type AppConfig = {
  verification_rules: VerificationRules
  model_config: ModelConfig
  repo_settings: RepoSettings
}

export type LogItem = {
  id: string
  timestamp: string
  stage: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'ALERT' | 'PASS' | 'FAIL'
  message: string
}

/* ─── Clean Initial State (ZERO Demo Data) ──────────────────────────── */

export const initialConfig: AppConfig = {
  verification_rules: {
    min_trust_score: 80,
    auto_quarantine_first_timers: true,
    blast_radius_threshold: 50,
    block_slopsquatting: true,
    fuzzing_mutation_count: 128,
    strict_mode: true,
  },
  model_config: {
    model_name: 'llama-3.3-70b-versatile',
    provider: 'Groq Cloud / Open-Source LPU',
    inference_endpoint: 'https://api.groq.com/openai/v1',
    temperature: 0.2,
    context_window: '128k',
    api_key: '',
  },
  repo_settings: {
    webhook_url: 'http://127.0.0.1:8000/webhook',
    webhook_secret: '',
    auto_merge_on_pass: false,
    sandbox_timeout_sec: 30,
    quarantine_unverified_bots: true,
  },
}

export const initialGitHubUser: GitHubUser = {
  authenticated: true,
  username: 'asfandkhan8585-cpu',
  name: 'Asfand Khan',
  avatar_url: 'https://github.com/asfandkhan8585-cpu.png',
  company: 'Maintainer',
  public_repos: 1,
  role: 'Verified Maintainer',
}

export const initialRepos: GitHubRepo[] = [
  {
    id: 'repo-ghostrepro-main',
    full_name: 'asfandkhan8585-cpu/GhostReproMissionControlDashboard',
    name: 'GhostReproMissionControlDashboard',
    description: 'Zero-Trust Autonomous Merge Gatekeeper & PR Security Intelligence',
    is_active: true,
    is_private: false,
    stars: 1,
    forks: 0,
    open_prs: 0,
    quarantined_prs: 0,
    repro_tests: 0,
    language: 'Python',
    default_branch: 'main',
  }
]

export const initialPRs: PRRecord[] = []
export const initialEvents: PipelineEvent[] = []
export const initialRepros: IssueRepro[] = []
export const initialReproCodeSamples: Record<number, string> = {}
export const initialSlopFlags: SlopsquatFlag[] = []
export const initialWhitelist: string[] = []
export const initialLogs: LogItem[] = []

/* ─── Generic Fetch Helpers with Per-Operation Timeouts ──────────────── */

async function fetchJSON<T>(path: string, timeoutMs = 10000): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`API ${path} (${res.status}): ${errorText || res.statusText}`)
  }
  return res.json()
}

async function postJSON<T>(path: string, body: unknown = {}, timeoutMs = 20000): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`API ${path} (${res.status}): ${errorText || res.statusText}`)
  }
  return res.json()
}

/* ─── Telemetry & Metrics ───────────────────────────────────────────── */

export async function checkHealth(): Promise<{ status: string; active_repo?: string }> {
  return await fetchJSON('/api/health', 4000)
}

export async function getMetrics(): Promise<DashboardMetrics> {
  return await fetchJSON<DashboardMetrics>('/api/dashboard/metrics', 10000)
}

export async function getPRs(): Promise<PRRecord[]> {
  const data = await fetchJSON<{ pull_requests: PRRecord[] }>('/api/dashboard/prs', 10000)
  return data.pull_requests || []
}

export async function simulatePR(targetRepo?: string): Promise<any> {
  return await postJSON('/api/dashboard/prs/simulate', { repo: targetRepo }, 20000)
}

export async function getQuarantine(): Promise<PRRecord[]> {
  const data = await fetchJSON<{ queue?: PRRecord[]; quarantine_queue?: PRRecord[] }>('/api/dashboard/quarantine', 10000)
  return data.queue || data.quarantine_queue || []
}

export async function getPipelineEvents(): Promise<PipelineEvent[]> {
  const data = await fetchJSON<{ events: PipelineEvent[] }>('/api/dashboard/pipeline', 10000)
  return data.events || []
}

export async function getIssueRepros(): Promise<IssueRepro[]> {
  const data = await fetchJSON<{ issues?: IssueRepro[]; reproductions?: IssueRepro[] }>('/api/dashboard/issues', 10000)
  return data.issues || data.reproductions || []
}

export async function getSlopsquatFlags(): Promise<SlopsquatFlag[]> {
  const data = await fetchJSON<{ flagged?: SlopsquatFlag[]; flagged_packages?: SlopsquatFlag[] }>('/api/dashboard/slopsquat', 10000)
  return data.flagged || data.flagged_packages || []
}

export async function getWhitelistedPackages(): Promise<string[]> {
  const data = await fetchJSON<{ whitelisted?: string[] }>('/api/dashboard/slopsquat', 10000)
  return data.whitelisted || []
}

/* ─── GitHub Auth & Repositories ────────────────────────────────────── */

export async function getGitHubUser(): Promise<GitHubUser> {
  return await fetchJSON<GitHubUser>('/api/github/user', 10000)
}

export async function authorizeGitHub(token?: string, username?: string): Promise<{ status: string; user: GitHubUser; repos: GitHubRepo[] }> {
  const cleanUsername = (username || '').trim().replace(/^@/, '')
  if (!cleanUsername) {
    throw new Error('Please enter a GitHub username.')
  }
  return await postJSON('/api/github/authorize', { token: token?.trim(), username: cleanUsername }, 15000)
}

export async function getGitHubRepos(): Promise<{ active_repo: string; repositories: GitHubRepo[] }> {
  return await fetchJSON<{ active_repo: string; repositories: GitHubRepo[] }>('/api/github/repos', 10000)
}

export async function selectRepo(repoId: string): Promise<{ status: string; active_repo: string; repo: GitHubRepo }> {
  return await postJSON('/api/github/repos/select', { repo_id: repoId }, 10000)
}

export async function syncGitHubRepos(): Promise<{ status: string; count: number; repositories: GitHubRepo[] }> {
  return await postJSON('/api/github/sync', {}, 20000)
}

export async function addCustomRepo(repo: { name: string; full_name?: string; description?: string; language?: string }): Promise<GitHubRepo> {
  const res = await postJSON<{ status: string; repo: GitHubRepo }>('/api/github/repos/add', repo, 10000)
  return res.repo
}

/* ─── Quarantine & Real GitHub PR Actions (Review & Merge) ───────────── */

export async function approveAndMergePR(
  repo: string,
  prNumber: number,
  token?: string
): Promise<{ success: boolean; message: string; merge_status?: number }> {
  return await postJSON('/api/dashboard/prs/merge', {
    repo,
    pr_number: prNumber,
    token: token?.trim(),
    merge_method: 'squash'
  }, 35000)
}

export async function authorizeUser(username: string, token?: string): Promise<{ status: string; username: string; message: string; github?: any }> {
  return await postJSON(`/api/dashboard/authorize/${encodeURIComponent(username)}`, {
    reason: 'Manually authorized by maintainer via Mission Control Dashboard.',
    token: token?.trim(),
    merge_on_github: true
  }, 35000)
}

export async function rejectUser(username: string, token?: string): Promise<{ status: string; username: string; message?: string }> {
  return await postJSON(`/api/dashboard/reject/${encodeURIComponent(username)}`, {
    token: token?.trim()
  }, 20000)
}

/* ─── Bug Reproductions ─────────────────────────────────────────────── */

export async function createIssueRepro(issueNumber: number, title: string, description = ''): Promise<{ status: string; issue: IssueRepro }> {
  return await postJSON('/api/dashboard/issues/create', { issue_number: issueNumber, title, description }, 35000)
}

export async function runIssueRepro(issueNumber: number): Promise<{ status: string; issue_number: number; repro_status: 'RED' | 'GREEN'; details?: string; exit_code?: number }> {
  return await postJSON(`/api/dashboard/issues/${issueNumber}/run`, {}, 25000)
}

export async function getIssueReproCode(issueNumber: number): Promise<{ issue_number: number; test_file: string; code: string }> {
  return await fetchJSON(`/api/dashboard/issues/${issueNumber}/code`, 10000)
}

/* ─── PyPI Slopsquatting ────────────────────────────────────────────── */

export async function scanPackage(packageName: string): Promise<{
  package: string
  status: 'LEGITIMATE' | 'HALLUCINATED' | 'WHITELISTED' | 'SUSPICIOUS' | 'FLAGGED'
  is_threat: boolean
  latest_version?: string
  summary?: string
  author?: string
  message: string
}> {
  return await postJSON('/api/slopsquat/scan', { package: packageName.trim() }, 15000)
}

export async function whitelistPackage(packageName: string): Promise<{ status: string; package: string; whitelisted_packages: string[] }> {
  return await postJSON('/api/slopsquat/whitelist', { package: packageName.trim() }, 10000)
}

export async function deleteSlopsquat(packageName: string): Promise<{ status: string; package: string }> {
  const res = await fetch(`${API_BASE}/api/slopsquat/${encodeURIComponent(packageName.trim())}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`API delete error (${res.status}): ${errorText || res.statusText}`)
  }
  return res.json()
}

export async function autoScanRepoDependencies(): Promise<{
  status: string
  scanned_count: number
  threats_count: number
  results: Array<{
    package: string
    status: string
    is_threat: boolean
    latest_version?: string
    message: string
  }>
}> {
  return await postJSON('/api/slopsquat/auto-scan-repo', {}, 30000)
}

/* ─── Execution Logs & Sandbox ──────────────────────────────────────── */

export async function getExecutionLogs(): Promise<LogItem[]> {
  const data = await fetchJSON<{ logs: LogItem[] }>('/api/dashboard/logs', 10000)
  return data.logs || []
}

export async function clearExecutionLogs(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/dashboard/logs`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`API error (${res.status}): ${errorText || res.statusText}`)
  }
  return res.json()
}

export async function resetAllData(): Promise<{ status: string }> {
  return await postJSON('/api/dashboard/reset', {}, 10000)
}

export async function triggerSandboxSuite(suite = 'regression', prId = 'pr-001'): Promise<{ status: string; exit_code: number; passed_count?: number; mutations_tested?: number }> {
  return await postJSON('/api/sandbox/trigger-test', { suite, pr_id: prId }, 25000)
}

/* ─── Configuration ─────────────────────────────────────────────────── */

export async function getConfig(): Promise<AppConfig> {
  return await fetchJSON<AppConfig>('/api/config', 10000)
}

export async function updateConfig(updates: {
  verification_rules?: Partial<VerificationRules>
  ai_model_config?: Partial<ModelConfig>
  repo_settings?: Partial<RepoSettings>
}): Promise<{ status: string; config: AppConfig }> {
  return await postJSON('/api/config', updates, 15000)
}

export async function testLLM(): Promise<{ status: string; model: string; endpoint: string; latency_ms: number; message: string }> {
  return await postJSON('/api/config/test-llm', {}, 35000)
}

export async function pingWebhook(): Promise<{ status: string; http_status?: number; event: PipelineEvent; message?: string }> {
  return await postJSON('/api/config/ping-webhook', {}, 15000)
}

export async function regenerateWebhookSecret(): Promise<{ status: string; webhook_secret: string }> {
  return await postJSON('/api/config/regenerate-secret', {}, 10000)
}

export async function calculateAST(originalCode: string, modifiedCode: string): Promise<{
  statement_delta: number
  scope_creep_detected: boolean
  original_statements: number
  modified_statements: number
  functions_added: string[]
  classes_added: string[]
}> {
  return await postJSON('/api/analyze/ast', { original_code: originalCode, modified_code: modifiedCode }, 20000)
}
