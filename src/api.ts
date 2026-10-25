/**
 * GhostRepro API Client
 *
 * Communicates with the FastAPI backend running on localhost:8000.
 * All fetch calls go through this single module so the base URL
 * only needs to change in one place.
 */

const API_BASE = 'http://localhost:8000'

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
  status: 'PASSED' | 'REJECTED' | 'QUARANTINED' | 'RUNNING'
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

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export async function getMetrics(): Promise<DashboardMetrics> {
  return fetchJSON('/api/dashboard/metrics')
}

export async function getPRs(): Promise<PRRecord[]> {
  const data = await fetchJSON<{ pull_requests: PRRecord[] }>('/api/dashboard/prs')
  return data.pull_requests
}

export async function getQuarantine(): Promise<PRRecord[]> {
  const data = await fetchJSON<{ quarantine_queue: PRRecord[]; count: number }>('/api/dashboard/quarantine')
  return data.quarantine_queue
}

export async function getPipelineEvents(): Promise<PipelineEvent[]> {
  const data = await fetchJSON<{ events: PipelineEvent[] }>('/api/dashboard/pipeline')
  return data.events
}

export async function getIssueRepros(): Promise<IssueRepro[]> {
  const data = await fetchJSON<{ reproductions: IssueRepro[] }>('/api/dashboard/issues')
  return data.reproductions
}

export async function getSlopsquatFlags(): Promise<SlopsquatFlag[]> {
  const data = await fetchJSON<{ flagged_packages: SlopsquatFlag[] }>('/api/dashboard/slopsquat')
  return data.flagged_packages
}

export async function authorizeUser(username: string): Promise<{ status: string; username: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/dashboard/authorize/${username}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Manually approved by maintainer via dashboard.' }),
  })
  if (!res.ok) throw new Error(`Authorize failed: ${res.status}`)
  return res.json()
}
