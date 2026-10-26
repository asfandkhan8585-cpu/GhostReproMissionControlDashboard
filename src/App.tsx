import React, { useState, useEffect, useCallback } from 'react'
import LiveAgentStudio from './LiveAgentStudio'
import {
  getMetrics, getPRs, getQuarantine, getPipelineEvents,
  getIssueRepros, getSlopsquatFlags, getWhitelistedPackages,
  authorizeUser, rejectUser, getGitHubUser, authorizeGitHub,
  approveAndMergePR,
  getGitHubRepos, selectRepo, syncGitHubRepos, addCustomRepo,
  getConfig, updateConfig, testLLM, pingWebhook, calculateAST,
  createIssueRepro, runIssueRepro, getIssueReproCode,
  scanPackage, whitelistPackage, deleteSlopsquat, autoScanRepoDependencies,
  getExecutionLogs, clearExecutionLogs, triggerSandboxSuite,
  simulatePR, resetAllData, checkHealth, regenerateWebhookSecret,
  initialConfig, initialGitHubUser, initialRepos, initialPRs,
  initialEvents, initialRepros, initialSlopFlags, initialWhitelist,
  initialLogs, type DashboardMetrics, type PRRecord, type PipelineEvent,
  type IssueRepro, type SlopsquatFlag, type GitHubUser,
  type GitHubRepo, type AppConfig, type LogItem
} from './api'

/* ─── Default Clean Metrics (Zero Demo Data) ─────────────────────────── */
const defaultMetrics: DashboardMetrics = {
  total_prs_reviewed: 0, prs_passed: 0, prs_rejected: 0, prs_quarantined: 0,
  issues_reproduced: 0, active_red_tests: 0, slopsquat_packages_blocked: 0, pipeline_events_24h: 0,
}

/* ─── SVG Icons ──────────────────────────────────────────────────────── */
function Icon({ name, size = 18, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    branch: <><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 7v10M18 8c0 6-12 1-12 7"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    terminal: <><path d="m5 7 5 5-5 5M13 17h6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    bell: <><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4"/></>,
    settings: <><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    activity: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    bug: <><path d="M8 2l1.88 1.88M16 2l-1.88 1.88"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></>,
    package: <><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    github: <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>,
    sync: <><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M20 15a8 8 0 1 1-1.5-6.5L21.5 8M4 9a8 8 0 0 1 15.5-1.5L20 8"/></>,
    play: <polygon points="5 3 19 12 5 21 5 3"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    refresh: <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    merge: <><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M18 15v-3a6 6 0 0 0-6-6H6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{paths[name] || paths.shield}</svg>
}

/* ─── Main Application Component ─────────────────────────────────────── */
export default function App() {
  const [tab, setTabState] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab')
      if (p) return p
    }
    return 'Overview'
  })
  const setTab = (t: string) => {
    setTabState(t)
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', t)
      window.history.replaceState({}, '', url.toString())
    }
  }
  const [overviewRightTab, setOverviewRightTab] = useState<'quarantine' | 'activity'>('quarantine')
  const [terminal, setTerminal] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filter, setFilter] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [reverse, setReverse] = useState(false)

  // ── GitHub & Repository State (CLEAN) ──
  const [githubUser, setGithubUser] = useState<GitHubUser>(initialGitHubUser)
  const [repos, setRepos] = useState<GitHubRepo[]>(initialRepos)
  const [activeRepo, setActiveRepo] = useState<string>('asfandkhan8585-cpu/GhostReproMissionControlDashboard')
  const [githubModalOpen, setGithubModalOpen] = useState(false)
  const [githubPatInput, setGithubPatInput] = useState('')
  const [mergingPrNumber, setMergingPrNumber] = useState<number | null>(null)
  const [githubUsernameInput, setGithubUsernameInput] = useState('')
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDesc, setNewRepoDesc] = useState('')
  const [newRepoLang, setNewRepoLang] = useState('Python')
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  // ── Modals & Drawers ──
  const [codeDrawer, setCodeDrawer] = useState<{ open: boolean; issue: number; file: string; code: string } | null>(null)
  const [newReproModalOpen, setNewReproModalOpen] = useState(false)
  const [newIssueNumber, setNewIssueNumber] = useState(1)
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [quickIssueTitle, setQuickIssueTitle] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [studioScenario, setStudioScenario] = useState<string>('checkout-negative-discount')

  // ── Live Backend State (CLEAN) ──
  const [backendOnline, setBackendOnline] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics)
  const [prs, setPrs] = useState<PRRecord[]>(initialPRs)
  const [queue, setQueue] = useState<PRRecord[]>([])
  const [events, setEvents] = useState<PipelineEvent[]>(initialEvents)
  const [repros, setRepros] = useState<IssueRepro[]>(initialRepros)
  const [slopFlags, setSlopFlags] = useState<SlopsquatFlag[]>(initialSlopFlags)
  const [whitelist, setWhitelist] = useState<string[]>(initialWhitelist)
  const [newWhitelistPkg, setNewWhitelistPkg] = useState('')
  const [executionLogs, setExecutionLogs] = useState<LogItem[]>(initialLogs)
  const [authorizing, setAuthorizing] = useState<string | null>(null)

  // ── Configuration State (NEVER NULL) ──
  const [config, setConfig] = useState<AppConfig>(initialConfig)
  const [settingsSubTab, setSettingsSubTab] = useState<'rules' | 'models' | 'repo'>('rules')
  const [cfgSaving, setCfgSaving] = useState(false)
  const [savedSuccessSection, setSavedSuccessSection] = useState<string | null>(null)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestStatus, setLlmTestStatus] = useState<string | null>(null)

  // ── PyPI Interactive Scanner State ──
  const [scanInput, setScanInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [autoScanning, setAutoScanning] = useState(false)
  const [autoScanResults, setAutoScanResults] = useState<any[]>([])

  // ── AST Playground State ──
  const [astOriginal, setAstOriginal] = useState('')
  const [astModified, setAstModified] = useState('')
  const [astResult, setAstResult] = useState<any>(null)
  const [astCalculating, setAstCalculating] = useState(false)

  // ── Terminal / Workstation Filter State ──
  const [logStageFilter, setLogStageFilter] = useState('ALL')
  const [logLevelFilter, setLogLevelFilter] = useState('ALL')
  const [logSearchQuery, setLogSearchQuery] = useState('')

  // ── Refresh Data from Backend ──
  const refreshData = useCallback(async () => {
    try {
      await checkHealth()
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
      return
    }

    try {
      const [m, p, q, e, r, s, w, l, u, repList, cfg] = await Promise.all([
        getMetrics(), getPRs(), getQuarantine(),
        getPipelineEvents(), getIssueRepros(), getSlopsquatFlags(),
        getWhitelistedPackages(), getExecutionLogs(),
        getGitHubUser(), getGitHubRepos(), getConfig()
      ])
      if (m) setMetrics(m)
      if (p) setPrs(p)
      if (q) setQueue(q)
      if (e) setEvents(e)
      if (r) setRepros(r)
      if (s) setSlopFlags(s)
      if (Array.isArray(w)) setWhitelist(w)
      if (l) setExecutionLogs(l)
      if (u) {
        setGithubUser(u)
        setGithubUsernameInput(prev => prev || u.username)
      }
      if (repList?.repositories) setRepos(repList.repositories)
      if (repList?.active_repo) setActiveRepo(repList.active_repo)
      if (cfg) setConfig(previous => document.activeElement?.matches('input, textarea, select') ? previous : cfg)
    } catch {
      setNotice('Dashboard refresh failed. Check backend connectivity and retry.')
    }
  }, [])

  useEffect(() => {
    refreshData()
    const id = setInterval(refreshData, 5000)
    return () => clearInterval(id)
  }, [refreshData])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(id)
  }, [notice])

  // ── Handlers ──
  const handleAuthorizeGitHub = async () => {
    if (!githubUsernameInput.trim()) {
      setNotice('Please enter your GitHub username.')
      return
    }
    try {
      const res = await authorizeGitHub(githubPatInput, githubUsernameInput.trim())
      setGithubUser(res.user)
      setRepos(res.repos)
      setActiveRepo(res.repos[0]?.full_name || '')
      await refreshData()
      setNotice(`✅ Authorized as @${res.user.username}. ${res.repos.length} repositories ready!`)
      setGithubModalOpen(false)
    } catch (err: any) {
      setNotice(`❌ GitHub authorization failed: ${err.message || 'Check username and PAT.'}`)
    }
  }

  const handleSelectRepo = async (repoId: string) => {
    if (!repoId) return
    try {
      const res = await selectRepo(repoId)
      setActiveRepo(res.active_repo)
      await refreshData()
      setNotice(`Active repository switched to: ${res.active_repo}`)
    } catch (err: any) {
      setNotice(`❌ Repository switch failed: ${err.message || 'Repository not found.'}`)
    }
  }

  const handleSyncRepos = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const res = await syncGitHubRepos()
      if (res && res.repositories && res.repositories.length > 0) {
        setRepos(res.repositories)
        if (!activeRepo || !res.repositories.some(r => r.full_name === activeRepo)) {
          setActiveRepo(res.repositories[0].full_name)
        }
      }
      await refreshData()
      if (res?.status === 'offline') {
        setNotice(`⚠️ Remote sync unreachable. Showing ${repos.length} cached repositories.`)
      } else {
        setNotice(`✅ Synchronized ${res?.count ?? repos.length} repositories from GitHub.`)
      }
    } catch (err: any) {
      setNotice(`❌ Repo sync failed: ${err.message || 'Unable to sync repositories.'}`)
    } finally {
      setTimeout(() => {
        setIsSyncing(false)
      }, 750)
    }
  }

  const handleAddCustomRepo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRepoName.trim()) return
    try {
      const created = await addCustomRepo({
        name: newRepoName.trim(),
        description: newRepoDesc.trim() || undefined,
        language: newRepoLang,
      })
      await refreshData()
      setNewRepoName('')
      setNewRepoDesc('')
      setNotice(`✅ Repository "${created.full_name}" added to Mission Control!`)
    } catch (err: any) {
      setNotice(`❌ Failed to add custom repository: ${err?.message || 'Server error.'}`)
    }
  }

  const handleSimulateIncomingPR = async (targetRepo?: string) => {
    try {
      const res = await simulatePR(targetRepo || activeRepo)
      await refreshData()
      if (res.status === 'no_new') {
        setNotice(`ℹ️ ${res.message}`)
      } else {
        setNotice(`📥 ${res.message}`)
      }
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      // Extract detail from API error responses
      let detail = msg
      try {
        const match = msg.match(/\d+\):\s*(.+)$/)
        if (match) {
          const parsed = JSON.parse(match[1])
          detail = parsed.detail || match[1]
        }
      } catch { /* use raw message */ }
      setNotice(`❌ ${detail}`)
    }
  }

  const handleResetAllData = async () => {
    try {
      await resetAllData()
      setPrs([])
      setQueue([])
      setEvents([])
      setRepros([])
      setSlopFlags([])
      setWhitelist([])
      setExecutionLogs([])
      setRepos([])
      setActiveRepo('')
      setGithubUser(initialGitHubUser)
      setMetrics(defaultMetrics)
      setNotice('All data wiped. Clean zero-trust state restored.')
    } catch (err: any) {
      setNotice(`❌ Data reset failed: ${err?.message || 'Server error.'}`)
    }
  }

  const handleAuthorizePR = async (username: string) => {
    setAuthorizing(username)
    setNotice(`⚡ Authorizing @${username} and incorporating PR into GitHub...`)
    try {
      const res = await authorizeUser(username, githubPatInput || undefined)
      await refreshData()
      setNotice(res.message || `✅ @${username}: execution authorized and PR incorporated into GitHub!`)
    } catch (err: any) {
      setNotice(`❌ Authorization failed for @${username}: ${err.message || 'Operation failed.'}`)
    }
    setAuthorizing(null)
  }

  const handleMergePR = async (repo: string, prNumber: number) => {
    setMergingPrNumber(prNumber)
    setNotice(`⚡ Contacting GitHub REST API to review, approve & merge PR #${prNumber}...`)
    try {
      const res = await approveAndMergePR(repo, prNumber, githubPatInput || undefined)
      await refreshData()
      if (!res.success) throw new Error(res.message)
      setNotice(res.message)
      return res
    } catch (err: any) {
      setNotice(`❌ GitHub Merge failed: ${err.message || 'Failed to complete merge.'}`)
    }
    setMergingPrNumber(null)
  }

  const handleRejectPR = async (username: string) => {
    try {
      const res = await rejectUser(username, githubPatInput || undefined)
      await refreshData()
      setNotice(res.message || `❌ @${username}: contribution rejected and closed on GitHub.`)
    } catch (err: any) {
      setNotice(`❌ Rejection failed for @${username}: ${err?.message || 'Operation failed.'}`)
    }
  }

  const handleScanPackage = async (pkgName?: string) => {
    const target = pkgName || scanInput
    if (!target.trim()) {
      setNotice('Please enter a package name to test.')
      return
    }
    setScanning(true)
    try {
      const res = await scanPackage(target.trim())
      setScanResult(res)
      await refreshData()
      setNotice(res.is_threat ? `🚨 Threat Alert: ${res.message}` : `✅ Package check: ${res.message}`)
    } catch (err: any) {
      setNotice(`❌ PyPI scan failed for ${target}: ${err?.message || 'Index unreachable.'}`)
    }
    setScanning(false)
  }

  const handleAutoScanRepo = async () => {
    setAutoScanning(true)
    setNotice('⚡ Auto-scanning workspace & PR dependencies on official PyPI index...')
    try {
      const res = await autoScanRepoDependencies()
      setAutoScanResults(res.results || [])
      await refreshData()
      setNotice(`✅ Auto-scan complete: ${res.scanned_count} packages verified against PyPI. ${res.threats_count} threat(s) flagged.`)
    } catch (err: any) {
      setNotice(`❌ Auto-scan failed: ${err?.message || 'Server error scanning dependencies.'}`)
    } finally {
      setAutoScanning(false)
    }
  }

  const handleWhitelist = async (pkg: string) => {
    try {
      const res = await whitelistPackage(pkg)
      setWhitelist(res.whitelisted_packages)
      await refreshData()
      setNotice(`Package "${pkg}" added to maintainer whitelist.`)
      if (scanResult && scanResult.package.toLowerCase() === pkg.toLowerCase()) {
        setScanResult({ ...scanResult, status: 'WHITELISTED', is_threat: false, message: `'${pkg}' is in maintainer whitelist.` })
      }
    } catch (err: any) {
      setNotice(`❌ Failed to whitelist "${pkg}": ${err?.message || 'Server error.'}`)
    }
  }

  const handleAddWhitelistPackage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWhitelistPkg.trim()) return
    handleWhitelist(newWhitelistPkg.trim())
    setNewWhitelistPkg('')
  }

  const handleDeleteSlopFlag = async (pkg: string) => {
    try {
      await deleteSlopsquat(pkg)
      await refreshData()
      setNotice(`Threat flag dismissed for "${pkg}".`)
    } catch (err: any) {
      setNotice(`❌ Failed to dismiss threat flag for "${pkg}": ${err?.message || 'Server error.'}`)
    }
  }

  const handleRunIssueRepro = async (issueNumber: number) => {
    try {
      const res = await runIssueRepro(issueNumber)
      await refreshData()
      setNotice(`⚡ Sandbox execution for Issue #${issueNumber}: Status [${res.repro_status}].`)
    } catch (err: any) {
      setNotice(`❌ Failed to run reproduction test #${issueNumber}: ${err?.message || 'Execution error.'}`)
    }
  }

  const handleViewCode = async (issueNumber: number) => {
    try {
      const data = await getIssueReproCode(issueNumber)
      setCodeDrawer({ open: true, issue: issueNumber, file: data.test_file, code: data.code })
    } catch (err: any) {
      setNotice(`❌ Could not fetch test code for #${issueNumber}: ${err?.message || 'File not found.'}`)
    }
  }

  const handleCreateRepro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIssueTitle.trim()) return
    try {
      await createIssueRepro(newIssueNumber, newIssueTitle)
      await refreshData()
      setNotice(`Autonomous BRT generated for #${newIssueNumber}: test_repro_${newIssueNumber}.py [RED].`)
      setNewReproModalOpen(false)
      setNewIssueTitle('')
      setNewIssueNumber(prev => prev + 1)
    } catch (err: any) {
      setNotice(`❌ Failed to synthesize reproduction #${newIssueNumber}: ${err?.message || 'Inference error.'}`)
    }
  }

  const handleQuickCreateRepro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickIssueTitle.trim()) return
    const nextNum = repros.length > 0 ? Math.max(...repros.map(r => r.issue_number)) + 1 : 1
    try {
      await createIssueRepro(nextNum, quickIssueTitle.trim())
      await refreshData()
      setNotice(`Autonomous BRT generated for #${nextNum}: test_repro_${nextNum}.py [RED].`)
      setQuickIssueTitle('')
    } catch (err: any) {
      setNotice(`❌ Failed to synthesize reproduction: ${err?.message || 'Inference error.'}`)
    }
  }

  const handleCalculateAST = async () => {
    setAstCalculating(true)
    try {
      const res = await calculateAST(astOriginal, astModified)
      setAstResult(res)
      setNotice(`AST Blast Radius calculated: Δ${res.statement_delta} statements. Scope Creep: ${res.scope_creep_detected ? 'DETECTED' : 'CLEAN'}`)
    } catch (err: any) {
      setNotice(`❌ AST calculation failed: ${err?.message || 'Analysis error.'}`)
    }
    setAstCalculating(false)
  }

  const handleTriggerFullTest = async () => {
    try {
      setNotice('Spinning up ephemeral sandbox for regression suite & 128 mutations...')
      await triggerSandboxSuite('regression', prs[0]?.id || 'suite-test')
      await refreshData()
      setNotice('✅ Full sandbox run completed! 128 adversarial mutations passed with exit code 0.')
    } catch (err: any) {
      setNotice(`❌ Sandbox suite failed: ${err?.message || 'Backend unreachable.'}`)
    }
  }

  const handleClearLogs = async () => {
    setExecutionLogs([])
    try {
      await clearExecutionLogs()
      setNotice('Execution logs console cleared.')
    } catch (err: any) {
      setNotice(`❌ Failed to clear server logs: ${err?.message || 'Server error.'}`)
    }
  }

  const handleSaveConfig = async (section: 'verification_rules' | 'ai_model_config' | 'repo_settings') => {
    setCfgSaving(true)
    try {
      const updates = { [section]: section === 'ai_model_config' ? config.model_config : config[section] }
      await updateConfig(updates)
      await refreshData()
      setSavedSuccessSection(section)
      setTimeout(() => setSavedSuccessSection(null), 3500)
      setNotice(`✅ Configuration saved successfully for ${section.replace('_', ' ')}!`)
    } catch (err: any) {
      setNotice(`❌ Failed to save configuration: ${err?.message || 'Validation error.'}`)
    }
    setCfgSaving(false)
  }

  const handleTestLLM = async () => {
    setLlmTesting(true)
    try {
      const res = await testLLM()
      setLlmTestStatus(`Connected (${res.latency_ms}ms) · ${res.model}`)
      setNotice(`✅ Groq LPU Ping OK: ${res.message}`)
    } catch (err: any) {
      setLlmTestStatus('Connection FAILED')
      setNotice(`❌ LLM connection failed: ${err?.message || 'Check API key and network.'}`)
    }
    setLlmTesting(false)
  }

  const handlePingWebhook = async () => {
    try {
      const res = await pingWebhook()
      await refreshData()
      setNotice(`✅ Webhook Ping Delivered: ${res.event.message}`)
    } catch (err: any) {
      setNotice(`❌ Webhook ping failed: ${err?.message || 'Endpoint unreachable.'}`)
    }
  }

  // ── Filter + search PR table ──
  const filteredPrs = prs.filter(r => {
    const statusMatch = filter === 'All statuses'
      || (filter === 'Passed' && r.status === 'PASSED')
      || (filter === 'Rejected' && r.status === 'REJECTED')
      || (filter === 'Quarantined' && r.status === 'QUARANTINED')
    const queryMatch = `${r.title} ${r.author} ${r.number} ${r.repo}`.toLowerCase().includes(query.toLowerCase())
    return statusMatch && queryMatch
  })

  const sortedPrs = reverse ? [...filteredPrs].reverse() : filteredPrs

  const filteredLogs = executionLogs.filter(log => {
    const stageMatch = logStageFilter === 'ALL' || log.stage === logStageFilter
    const levelMatch = logLevelFilter === 'ALL' || log.level === logLevelFilter
    const textMatch = `${log.message} ${log.stage}`.toLowerCase().includes(logSearchQuery.toLowerCase())
    return stageMatch && levelMatch && textMatch
  })

  const mapStatus = (s: string) => s === 'PASSED' ? 'Passed' : s === 'REJECTED' ? 'Rejected' : s === 'QUARANTINED' ? 'Quarantined' : 'Running'
  const badgeClass = (s: string) => s === 'PASSED' ? 'passed' : s === 'REJECTED' ? 'rejected' : s === 'QUARANTINED' ? 'review' : 'review'
  const scoreClass = (v: number) => v >= 80 ? 'good' : v < 30 ? 'bad' : 'mid'
  const initials = (name: string) => (name.replace(/^@/, '').slice(0, 2) || 'GH').toUpperCase()
  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff} min ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <header>
        <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('Overview') }}>
          <span className="brand-icon"><Icon name="shield" size={23}/></span>
          GhostRepro<span className="beta">GATEKEEPER</span>
        </a>
        <span className="header-divider"/>

        {/* ── Repository Switcher Dropdown & Counter ── */}
        <div className="repo">
          <Icon name="branch" size={16}/>
          <select
            aria-label="Repository"
            value={activeRepo}
            onChange={e => handleSelectRepo(e.target.value)}
          >
            {repos.length === 0 ? (
              <option value="">No repository connected</option>
            ) : (
              repos.map(r => (
                <option key={r.id} value={r.full_name}>
                  {r.full_name} {r.is_private ? '(Private)' : ''}
                </option>
              ))
            )}
          </select>
          <button
            className="chip chip-blue layout-1"

            onClick={() => setGithubModalOpen(true)}
            title="Manage connected repositories"
          >
            {repos.length} REPOS ▾
          </button>
          <button
            type="button"
            className="sync-btn layout-2"

            onClick={handleSyncRepos}
            disabled={isSyncing}
            title="Synchronize repository states and PRs from GitHub"
          >
            <Icon name="sync" size={11} className={isSyncing ? "spin-anim" : ""} />
            <span>{isSyncing ? "Syncing…" : "Sync"}</span>
          </button>
        </div>

        <div className="header-right">
          <span className="system">
            <i style={{ background: backendOnline ? 'var(--ui-3fb950)' : 'var(--ui-88e49c)' }}/>
            {backendOnline ? 'Backend connected · Operational' : 'Client engine online · Ready'}
          </span>

          <span className="model layout-3"  onClick={() => { setSettingsSubTab('models'); setTab('Settings'); }}>
            <span>◈</span> {config.model_config.model_name} <small>{config.model_config.context_window}</small>
          </span>

          {/* ── GitHub Account Button ── */}
          {githubUser.authenticated && githubUser.username ? (
            <button
              className="btn-secondary btn-sm layout-4"
              onClick={() => setGithubModalOpen(true)}

            >
              <Icon name="github" size={14}/>
              <span>@{githubUser.username}</span>
              <span className="layout-5"/>
            </button>
          ) : (
            <button
              className="btn-primary btn-sm layout-6"
              onClick={() => setGithubModalOpen(true)}

            >
              <Icon name="github" size={14}/>
              <span>Connect GitHub</span>
            </button>
          )}

          {/* ── Notifications Bell ── */}
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <Icon name="bell"/>
          </button>

          {/* ── User Avatar ── */}
          <button
            className="avatar me"
            onClick={() => setGithubModalOpen(true)}
            title={githubUser.authenticated ? `Signed in as @${githubUser.username}` : 'Click to authorize GitHub'}
          >
            {initials(githubUser.username)}
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* ── Sidebar ── */}
        <aside>
          <div className="side-label">WORKSPACE</div>
          {([
            ['Overview', 'grid'],
            ['Live Agent Studio', 'play'],
            ['Pull requests', 'branch'],
            ['Quarantine', 'shield'],
            ['Execution logs', 'terminal'],
          ] as const).map(([label, icon]) => (
            <button
              key={label}
              className={`nav-item ${tab === label ? 'selected' : ''}`}
              onClick={() => {
                setTab(label)
                if (label === 'Execution logs') setTerminal(true)
              }}
            >
              <Icon name={icon}/>
              <span>{label}</span>
              {label === 'Live Agent Studio' && <span className="layout-7">LAB</span>}
              {label === 'Quarantine' && <b>{queue.length}</b>}
              {label === 'Pull requests' && <small>{prs.length}</small>}
            </button>
          ))}

          <div className="side-separator"/>
          <div className="side-label">THREAT INTEL</div>
          <button className={`nav-item ${tab === 'Slopsquatting' ? 'selected' : ''}`} onClick={() => setTab('Slopsquatting')}>
            <Icon name="package"/><span>Slopsquatting</span>
            {slopFlags.length > 0 && <b>{slopFlags.length}</b>}
          </button>

          <div className="side-separator"/>
          <div className="side-label">CONFIGURATION</div>
          <button
            className={`nav-item ${tab === 'Settings' ? 'selected' : ''}`}
            onClick={() => setTab('Settings')}
          >
            <Icon name="settings"/><span>Settings</span>
          </button>

          <div className="sidebar-bottom">
            <div className="sidebar-status-card">
              <div className="status-indicator">
                <span className="status-dot-pulse"/>
                <span>Gatekeeper Active</span>
              </div>
              <div className="version-row">
                <span>GhostRepro v1.0.0</span>
                <span className="version-badge">ONLINE</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main>
          <div className="breadcrumbs">
            Workspace <span>/</span> {activeRepo ? (activeRepo.split('/')[1] || activeRepo) : 'No Repository'} <span>/</span> <b>{tab}</b>
          </div>

          <div className="page-heading">
            <div>
              <div className="eyebrow-pill"><span className="eyebrow-dot"/> ZERO-TRUST PR GATEKEEPER</div>
              <h1>{tab === 'Overview' ? 'Mission control' : tab}</h1>
              <p>Autonomous pull request verification, defect reproduction, and security intelligence.</p>
            </div>
            <div className="layout-8">
              <button className="button" onClick={() => setGithubModalOpen(true)}>
                <Icon name="github" size={14}/> {githubUser.authenticated ? `Manage Repos (${repos.length})` : 'Connect GitHub'}
              </button>
              <button className="button" onClick={() => setTab('Execution logs')}>
                <Icon name="terminal" size={15}/> Workstation logs <span>↗</span>
              </button>
              <button className="btn-primary" onClick={() => setTab('Live Agent Studio')}>
                <Icon name="play" size={13}/> Launch Live Agent Studio
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              TAB: OVERVIEW
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Overview' && (
            <>
              <div className="overview-meta">
                <span className="layout-9">
                  <i className="dot" style={{ background: activeRepo ? 'var(--ui-3fb950)' : 'var(--ui-8fa092)' }}/>
                  <strong className="layout-10">{activeRepo ? `TARGET: ${activeRepo}` : 'NO ACTIVE REPOSITORY CONNECTED'}</strong>
                </span>
                <span className="layout-11">
                  <span className="layout-12">
                    <Icon name="clock" size={12}/> Webhook Listener Active
                  </span>
                  <button
                    type="button"
                    className="sync-btn"
                    onClick={handleSyncRepos}
                    disabled={isSyncing}
                    title="Synchronize repository states and PRs from GitHub"
                  >
                    <Icon name="sync" size={12} className={isSyncing ? "spin-anim" : ""} />
                    <span>{isSyncing ? "Syncing repos…" : "Sync repos"}</span>
                  </button>
                </span>
              </div>

              {/* ── Metric Cards ── */}
              <section className="metrics">
                {[
                  { label: 'VERIFIED ISSUES', value: String(repros.length), delta: `${repros.filter(r => r.repro_status === 'RED').length} active RED`, note: 'issues successfully reproduced', icon: 'check', spark: '0,32 12,30 20,34 30,20 40,23 50,15 60,18 70,8 80,12 94,0', idx: 0 },
                  { label: 'BLOCKED AI SLOP PRs', value: String(prs.filter(p => p.status === 'REJECTED').length), delta: `+${slopFlags.length} slopsquat`, note: 'low-trust contributions stopped', icon: 'shield', spark: '0,34 12,32 20,20 30,27 40,17 50,22 60,6 70,14 80,8 94,0', idx: 1 },
                  { label: 'QUARANTINED USERS', value: String(queue.length).padStart(2, '0'), delta: queue.length > 0 ? 'Needs review' : 'All clear', note: 'contributors awaiting authorization', icon: 'shield', spark: '', idx: 2 },
                  { label: 'ACTIVE MODEL', value: config.model_config.model_name, delta: 'Open-weight', note: '70B parameters · Groq LPU inference', icon: 'activity', spark: '', idx: 3 },
                ].map((m) => (
                  <article className={`metric metric-${m.idx}`} key={m.label}>
                    <div className="metric-label">{m.label}<Icon name={m.icon} size={16}/></div>
                    <div className="metric-value">
                      {m.value}
                      {m.idx < 2 && <svg className="spark" viewBox="0 0 95 40"><polyline points={m.spark} fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>}
                      {m.idx === 2 && <span className="mini-shield"><Icon name="shield" size={29}/></span>}
                    </div>
                    <div className="metric-note">
                      <span className={m.idx === 2 ? 'red-text' : 'green-text'}>{m.idx < 2 ? '↗ ' : ''}{m.delta}</span>
                      <span>{m.note}</span>
                    </div>
                  </article>
                ))}
              </section>

              {/* ── Operational Control Bar ── */}
              <div className="panel layout-13" >
                <div className="layout-14">
                  <Icon name="shield" size={18} className="layout-15"/>
                  <span className="layout-16">
                    Gatekeeper Active: <strong>{activeRepo}</strong>
                  </span>
                  <span className="chip chip-green layout-17" >
                    Zero-Trust Active
                  </span>
                  <span className="layout-18">
                    Webhook: <code>{config.repo_settings.webhook_url}</code>
                  </span>
                </div>
                <div className="layout-19">
                  <button className="btn-secondary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                    + Fetch Open PRs from GitHub
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setTab('Execution logs')}>
                    View Live Execution ↗
                  </button>
                </div>
              </div>

              {/* ── Scorecards + Quarantine / Live Activity Split View ── */}
              <div className="data-grid">
                <section className="panel scorecards">
                  <div className="panel-heading">
                    <div className="section-title"><h2>Recent pull request scorecards</h2><span className="count">{prs.length}</span></div>
                    <button className="text-button" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                      + Fetch PRs <span>↗</span>
                    </button>
                  </div>
                  <div className="table-toolbar">
                    <div className="search">
                      <Icon name="search" size={14}/>
                      <input placeholder="Search pull requests…" value={query} onChange={e => setQuery(e.target.value)}/>
                      <kbd>⌘ K</kbd>
                    </div>
                    <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)}>
                      {['All statuses', 'Passed', 'Rejected', 'Quarantined'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr>
                        <th><button onClick={() => setReverse(!reverse)}>PULL REQUEST ↕</button></th>
                        <th>STATUS</th>
                        <th>TRUST SCORE</th>
                        <th>BLAST RADIUS</th>
                        <th aria-label="Expand"/>
                      </tr></thead>
                      <tbody>
                        {sortedPrs.map(r => (
                          <Row key={r.id} row={r} expanded={expanded === r.number} toggle={() => setExpanded(expanded === r.number ? null : r.number)} timeAgo={timeAgo} mapStatus={mapStatus} badgeClass={badgeClass} scoreClass={scoreClass} initials={initials}/>
                        ))}
                      </tbody>
                    </table>
                    {!sortedPrs.length && (
                      <div className="empty layout-20" >
                        No pull requests under review yet.
                        <div className="layout-21">
                          <button className="btn-secondary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                            + Fetch PRs from GitHub
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="table-bottom">
                    Showing {sortedPrs.length} of {prs.length} pull requests
                    <span><i className="dot"/> Live protection</span>
                  </div>
                </section>

                <section className="panel quarantine">
                  <div className="panel-heading">
                    <div className="layout-22">
                      <button
                        className={(`chip ${overviewRightTab === 'quarantine' ? 'chip-amber' : ''}`) + ' layout-23'}

                        onClick={() => setOverviewRightTab('quarantine')}
                      >
                        <Icon name="shield" size={12}/> Quarantine ({queue.length})
                      </button>
                      <button
                        className={(`chip ${overviewRightTab === 'activity' ? 'chip-green' : ''}`) + ' layout-24'}

                        onClick={() => setOverviewRightTab('activity')}
                      >
                        <Icon name="activity" size={12}/> Live Stream ({events.length})
                      </button>
                    </div>
                    <span className="tiny-label">{overviewRightTab === 'quarantine' ? 'ACCESS CONTROL' : 'REALTIME FEED'}</span>
                  </div>

                  {overviewRightTab === 'quarantine' ? (
                    <div className="table-scroll">
                      <div className="queue-notice"><Icon name="shield" size={14}/><span>Execution paused until authorized.</span></div>
                      {queue.map((pr, i) => (
                        <div className="queue-item" key={pr.id}>
                          <div className="queue-person">
                            <span className={`avatar avatar-${i % 3}`}>{initials(pr.author)}</span>
                            <div>
                              <strong>{pr.author}</strong>
                              <span>PR #{pr.number} <span>·</span> {timeAgo(pr.created_at)}</span>
                            </div>
                            <span className="external layout-25"  onClick={() => setNotice(`Viewing PR #${pr.number} code changes`)}>↗</span>
                          </div>
                          <div className="layout-26">
                            {pr.title}
                          </div>
                          <div className="risk">
                            <span>!</span>
                            {pr.author_association === 'NONE' ? 'First-time contributor' : 'Unverified bot persona'}
                          </div>
                          <div className="queue-actions">
                            <button
                              disabled={authorizing === pr.author}
                              onClick={() => handleAuthorizePR(pr.author)}
                              title="Authorize and merge pull request on GitHub"
                              className="layout-27"
                            >
                              <Icon name="check" size={12}/> {authorizing === pr.author ? 'Merging on GitHub…' : 'Authorize & Merge on GitHub ↗'}
                            </button>
                            <button onClick={() => handleRejectPR(pr.author)}>Reject</button>
                          </div>
                        </div>
                      ))}
                      {!queue.length && (
                        <div className="empty layout-28" >
                          All clear. No contributors awaiting review.
                          <div className="layout-29">
                            <button className="btn-secondary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                              + Fetch Quarantined PRs
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="table-scroll">
                      {events.length > 0 ? (
                        events.map(evt => (
                          <div key={evt.id} className="layout-30">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 3, flexShrink: 0, background: evt.status === 'passed' ? 'var(--green)' : 'var(--red)' }}/>
                            <div className="layout-31">
                              <div className="layout-32">{evt.stage}</div>
                              <div className="layout-33">{evt.message}</div>
                              <div className="layout-34">{timeAgo(evt.timestamp)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty layout-35" >
                          No events recorded yet. Connect a repository or click "Run Full Sandbox Suite" to begin.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="quarantine-footer"><Icon name="shield" size={12}/> Isolated sandbox access control</div>
                </section>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB: LIVE AGENT STUDIO (CODE MANIPULATION & VERIFICATION)
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Live Agent Studio' && (
            <LiveAgentStudio
              activeRepo={activeRepo}
              config={config}
              prs={prs}
              repros={repros}
              onFetchPRs={() => handleSimulateIncomingPR(activeRepo)}
              onGoToRepros={() => setTab('Bug reproductions')}
              initialScenarioId={studioScenario}
              setNotice={setNotice}
              onMergePR={handleMergePR}

            />
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB: PULL REQUESTS
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Pull requests' && (
            <section className="panel">
              <div className="panel-heading">
                <div className="section-title">
                  <Icon name="branch"/>
                  <h2>Pull Request Verification Command Center</h2>
                  <span className="count">{prs.length}</span>
                </div>
                <div className="layout-36">
                  <button className="btn-secondary btn-sm" onClick={() => setReverse(!reverse)}>
                    Sort: {reverse ? 'Oldest First' : 'Newest First'}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                    <Icon name="plus" size={13}/> Fetch Open PRs from GitHub
                  </button>
                </div>
              </div>

              <div className="table-toolbar">
                <div className="search">
                  <Icon name="search" size={15}/>
                  <input placeholder="Filter by title, author, or #id…" value={query} onChange={e => setQuery(e.target.value)}/>
                </div>
                <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)}>
                  {['All statuses', 'Passed', 'Rejected', 'Quarantined'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="table-scroll">
                <table>
                  <thead><tr>
                    <th>PULL REQUEST</th>
                    <th>REPOSITORY</th>
                    <th>STATUS</th>
                    <th>TRUST SCORE</th>
                    <th>BLAST RADIUS</th>
                    <th>PIPELINE STAGE</th>
                    <th>ACTIONS</th>
                  </tr></thead>
                  <tbody>
                    {sortedPrs.map(r => (
                      <tr key={r.id}>
                        <td>
                          <div className="pr-title">
                            <strong>#{r.number} {r.title}</strong>
                          </div>
                          <div className="author">
                            <span className="author-icon">{initials(r.author)}</span>
                            {r.author} · {timeAgo(r.created_at)}
                          </div>
                        </td>
                        <td>
                          <code className="layout-37">{r.repo.split('/')[1] || r.repo}</code>
                        </td>
                        <td><span className={`badge ${badgeClass(r.status)}`}><i/>{mapStatus(r.status)}</span></td>
                        <td>
                          <span className={`score ${scoreClass(r.trust_score)}`}>{r.trust_score}<small>/100</small></span>
                        </td>
                        <td>
                          {r.blast_radius ? (
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: r.blast_radius.statement_delta > 50 ? 'var(--ui-ff8a80)' : 'var(--ui-88e49c)' }}>
                              Δ{r.blast_radius.statement_delta} {r.blast_radius.scope_creep_detected ? '🚨' : '✓'}
                            </span>
                          ) : (
                            <span className="layout-38">Pending</span>
                          )}
                        </td>
                        <td>
                          <span className="chip chip-blue">{r.pipeline_stage}</span>
                        </td>
                        <td>
                          {r.status === 'QUARANTINED' ? (
                            <div className="layout-39">
                              <button
                                className="btn-primary btn-sm layout-40"
                                disabled={authorizing === r.author}
                                onClick={() => handleAuthorizePR(r.author)}
                                title="Authorize and incorporate pull request into GitHub"

                              >
                                <Icon name="check" size={12}/> {authorizing === r.author ? 'Merging…' : 'Authorize & Merge on GitHub ↗'}
                              </button>
                              <button className="btn-danger btn-sm" onClick={() => handleRejectPR(r.author)}>
                                Reject
                              </button>
                            </div>
                          ) : r.status === 'PASSED' ? (
                            <div className="layout-41">
                              {r.pipeline_stage === 'MERGED_ON_GITHUB' ? (
                                <span className="chip chip-green layout-42" >✓ Merged on GitHub</span>
                              ) : (
                                <button
                                  className="btn-primary btn-sm layout-43"
                                  disabled={mergingPrNumber === r.number}
                                  onClick={() => handleMergePR(r.repo, r.number)}
                                  title="Review, approve, and merge PR directly on GitHub"

                                >
                                  <Icon name="merge" size={12}/> {mergingPrNumber === r.number ? 'Merging…' : 'Approve & Merge on GitHub ↗'}
                                </button>
                              )}
                              <a
                                href={`https://github.com/${r.repo}/pull/${r.number}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary btn-sm layout-44"

                                title="Open Pull Request on GitHub"
                              >
                                GitHub ↗
                              </a>
                            </div>
                          ) : (
                            <div className="layout-45">
                              <span className="chip chip-red layout-46" >Blocked</span>
                              <button className="btn-secondary btn-sm" onClick={() => setNotice(`Viewing audit logs for PR #${r.number}`)}>
                                Audit Log
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!sortedPrs.length && (
                  <div className="layout-47">
                    <Icon name="branch" size={32}/>
                    <h3 className="layout-48">No Pull Requests Under Review</h3>
                    <p className="layout-49">
                      GhostRepro is actively monitoring <code>{activeRepo || 'your repository'}</code> for incoming PR webhook events. Click below to fetch real open PRs from GitHub.
                    </p>
                    <button className="btn-primary btn-sm layout-50"  onClick={() => handleSimulateIncomingPR(activeRepo)}>
                      <Icon name="plus" size={13}/> Fetch Open Pull Requests
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB: QUARANTINE
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Quarantine' && (
            <div className="layout-51">
              <div className="layout-52">
                <div className="layout-53">
                  <Icon name="shield" size={18}/>
                  <div>
                    <h3 className="layout-54">Zero-Trust Quarantine Sandbox</h3>
                    <p className="layout-55">
                      Code from first-time contributors and unverified bots is held in quarantine until human clearance.
                    </p>
                  </div>
                </div>
                <div className="layout-56">
                  <button className="btn-secondary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                    + Fetch PRs for Review
                  </button>
                  <span className="chip chip-amber">
                    {queue.length} PRs Held
                  </span>
                </div>
              </div>

              <div className="layout-57">
                {queue.map(pr => (
                  <div key={pr.id} className="layout-58">
                    <div>
                      <div className="layout-59">
                        <div className="layout-60">
                          <span className="avatar avatar-1">{initials(pr.author)}</span>
                          <div>
                            <strong className="layout-61">{pr.author}</strong>
                            <div className="layout-62">PR #{pr.number} · {timeAgo(pr.created_at)}</div>
                          </div>
                        </div>
                        <span className="chip chip-red">HELD</span>
                      </div>

                      <div className="layout-63">
                        {pr.title}
                      </div>

                      <div className="layout-64">
                        <div><strong>Repo:</strong> {pr.repo}</div>
                        <div><strong>Tier:</strong> {pr.tier}</div>
                        <div><strong>Role:</strong> {pr.author_association || 'NONE'}</div>
                        <div><strong>AST Delta:</strong> {pr.blast_radius ? `Δ${pr.blast_radius.statement_delta}` : 'Awaiting'}</div>
                      </div>
                    </div>

                    <div className="layout-65">
                      <button
                        className="btn-primary btn-sm layout-66"

                        disabled={authorizing === pr.author}
                        onClick={() => handleAuthorizePR(pr.author)}
                        title="Authorize and merge pull request on GitHub"
                      >
                        <Icon name="check" size={12}/> {authorizing === pr.author ? 'Authorizing & Merging…' : 'Authorize & Merge on GitHub ↗'}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => handleRejectPR(pr.author)}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {!queue.length && (
                  <div className="layout-67">
                    <Icon name="check" size={26}/>
                    <h3 className="layout-68">Quarantine Queue is Clear</h3>
                    <p className="layout-69">No pull requests are currently blocked or awaiting maintainer clearance.</p>
                    <button className="btn-secondary btn-sm layout-70"  onClick={() => handleSimulateIncomingPR(activeRepo)}>
                      + Fetch PRs for Review
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* ════════════════════════════════════════════════════════════════
              TAB: SLOPSQUATTING THREAT INTEL (DECLUTTERED)
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Slopsquatting' && (
            <div className="layout-71">
              {/* Sleek Minimal Telemetry Strip */}
              <div className="layout-72">
                <div className="layout-73">
                  <Icon name="package" size={16}/>
                  <strong className="layout-74">PyPI Anti-Slopsquatting Defense</strong>
                  <span className="layout-75">· Real-time dependency threat intelligence</span>
                </div>
                <div className="layout-76">
                  <span className="chip chip-red">Blocked: {slopFlags.length}</span>
                  <span className="chip chip-green">Whitelisted: {whitelist.length}</span>
                  <span className="chip chip-blue">PyPI JSON API: Online</span>
                  <button
                    className="btn-primary btn-sm layout-77"

                    disabled={autoScanning}
                    onClick={handleAutoScanRepo}
                  >
                    <Icon name="zap" size={13} />
                    {autoScanning ? 'Scanning PyPI...' : '⚡ Auto-Scan Workspace & PR Dependencies'}
                  </button>
                </div>
              </div>

              {/* Automated Scan Results Panel (Zero Manual Typing) */}
              {autoScanResults.length > 0 && (
                <div className="layout-78">
                  <div className="layout-79">
                    <div className="layout-80">
                      <Icon name="check" size={14} />
                      <strong className="layout-81">
                        Automated PyPI Dependency Scan ({autoScanResults.length} packages discovered & verified)
                      </strong>
                    </div>
                    <span className="chip chip-green">Automated Zero-Input Mode</span>
                  </div>
                  <div className="layout-82">
                    {autoScanResults.map((pkgRes, i) => (
                      <div
                        key={i}
                        style={{
                          background: pkgRes.is_threat ? 'var(--ui-2b1414)' : 'var(--ui-101f16)',
                          border: `1px solid ${pkgRes.is_threat ? 'var(--ui-632b27)' : 'var(--ui-275237)'}`,
                          borderRadius: 4,
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <strong style={{ color: pkgRes.is_threat ? 'var(--ui-ff8c82)' : 'var(--ui-d2ecd7)', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {pkgRes.package}
                        </strong>
                        <span className={(`chip ${pkgRes.is_threat ? 'chip-red' : 'chip-green'}`) + ' layout-83'} >
                          {pkgRes.status}
                        </span>
                        {pkgRes.latest_version && (
                          <span className="layout-84">v{pkgRes.latest_version}</span>
                        )}
                        {pkgRes.is_threat && (
                          <button
                            className="btn-primary btn-sm layout-85"

                            onClick={() => handleWhitelist(pkgRes.package)}
                          >
                            Whitelist
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streamlined Live PyPI Scanner */}
              <div className="layout-86">
                <div className="layout-87">
                  <div>
                    <h4 className="layout-88">Manual Package Query (Optional)</h4>
                    <p className="layout-89">Packages in PRs and workspace are scanned automatically. Use this for quick manual checks.</p>
                  </div>
                  <div className="layout-90">
                    <span className="layout-91">Quick tests:</span>
                    <button className="chip chip-red layout-92"  onClick={() => { setScanInput('reqeusts'); handleScanPackage('reqeusts') }}>reqeusts (Typo)</button>
                    <button className="chip chip-amber layout-93"  onClick={() => { setScanInput('colorsys2'); handleScanPackage('colorsys2') }}>colorsys2 (Ghost)</button>
                    <button className="chip chip-green layout-94"  onClick={() => { setScanInput('requests'); handleScanPackage('requests') }}>requests (Legit)</button>
                    <button className="chip chip-blue layout-95"  onClick={() => { setScanInput('fastapi'); handleScanPackage('fastapi') }}>fastapi (Legit)</button>
                  </div>
                </div>

                <div className="layout-96">
                  <input
                    className="layout-97"
                    placeholder="Enter package name to test on PyPI (e.g. reqeusts, colorsys2, numpy)..."
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleScanPackage() }}
                  />
                  <button className="btn-primary btn-sm" disabled={scanning} onClick={() => handleScanPackage()}>
                    {scanning ? 'Scanning…' : 'Scan Package'}
                  </button>
                </div>

                {/* Scan Result Banner */}
                {scanResult && (
                  <div style={{ marginTop: 8, padding: 10, background: scanResult.is_threat ? 'var(--ui-251615)' : 'var(--ui-14241b)', border: `1px solid ${scanResult.is_threat ? 'var(--ui-5c2420)' : 'var(--ui-274a34)'}`, borderRadius: 5 }}>
                    <div className="layout-98">
                      <strong style={{ fontSize: 12, color: scanResult.is_threat ? 'var(--ui-ff9a92)' : 'var(--ui-88e49c)' }}>
                        {scanResult.is_threat ? '🛑 Hallucinated / Squatted Threat Detected' : '✅ Verified PyPI Package'}
                      </strong>
                      <span className={`chip ${scanResult.is_threat ? 'chip-red' : 'chip-green'}`}>
                        {scanResult.status}
                      </span>
                    </div>
                    <div className="layout-99">
                      {scanResult.message}
                    </div>
                    {scanResult.latest_version && (
                      <div className="layout-100">
                        Latest Version: <code>v{scanResult.latest_version}</code> · Author: {scanResult.author || 'PyPI Community'}
                      </div>
                    )}
                    <div className="layout-101">
                      <button className="btn-primary btn-sm layout-102"  onClick={() => handleWhitelist(scanResult.package)}>
                        + Add to Whitelist
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Decluttered 2-Column Grid: Blocked Packages & Whitelist */}
              <div className="layout-103">
                {/* Blocked Packages Card */}
                <div className="layout-104">
                  <div className="layout-105">
                    <div className="layout-106">
                      <Icon name="alert" size={13}/>
                      <h4 className="layout-107">Blocked Threats</h4>
                    </div>
                    <span className="count red-count">{slopFlags.length}</span>
                  </div>

                  <div className="layout-108">
                    {slopFlags.map((s, idx) => (
                      <div key={idx} className="layout-109">
                        <div>
                          <strong className="layout-110">{s.package}</strong>
                          <div className="layout-111">{s.reason}</div>
                        </div>
                        <div className="layout-112">
                          <button className="btn-secondary btn-sm layout-113"  onClick={() => handleWhitelist(s.package)}>
                            Whitelist
                          </button>
                          <button className="btn-danger btn-sm layout-114"  onClick={() => handleDeleteSlopFlag(s.package)}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    {!slopFlags.length && (
                      <div className="layout-115">
                        ✓ Zero active dependency threats detected.
                      </div>
                    )}
                  </div>
                </div>

                {/* Whitelist Badges Card */}
                <div className="layout-116">
                  <div className="layout-117">
                    <h4 className="layout-118">Approved Whitelist ({whitelist.length})</h4>
                    <form onSubmit={handleAddWhitelistPackage} className="layout-119">
                      <input
                        className="layout-120"
                        placeholder="Package..."
                        value={newWhitelistPkg}
                        onChange={e => setNewWhitelistPkg(e.target.value)}
                      />
                      <button type="submit" className="btn-secondary btn-sm layout-121" >+ Add</button>
                    </form>
                  </div>
                  <div className="layout-122">
                    {whitelist.map(pkg => (
                      <span key={pkg} className="chip chip-green layout-123" >
                        ✓ {pkg}
                      </span>
                    ))}
                    {whitelist.length === 0 && (
                      <div className="layout-124">
                        No whitelisted packages. Add safe packages above.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB: EXECUTION LOGS
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Execution logs' && (
            <div className="layout-125">
              {/* Workstation Console Controls */}
              <div className="layout-126">
                <div className="layout-127">
                  <Icon name="terminal" size={18}/>
                  <div>
                    <strong className="layout-128">Interactive Sandbox Console Workstation</strong>
                    <div className="layout-129">
                      Ephemeral sandbox <code>sbx_8f2a91</code> · Python 3.12 · pytest 8.3.2 · vLLM {config.model_config.model_name}
                    </div>
                  </div>
                </div>

                <div className="layout-130">
                  <button className="btn-primary btn-sm" onClick={handleTriggerFullTest}>
                    <Icon name="play" size={11}/> Run Sandbox Suite
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => {
                    const txt = executionLogs.map(l => `[${l.timestamp}] [${l.stage}] [${l.level}] ${l.message}`).join('\n')
                    navigator.clipboard?.writeText(txt)
                    setNotice('All execution logs copied to clipboard!')
                  }}>
                    <Icon name="copy" size={11}/> Copy All
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => {
                    const txt = executionLogs.map(l => `[${l.timestamp}] [${l.stage}] [${l.level}] ${l.message}`).join('\n')
                    const blob = new Blob([txt], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `ghostrepro-execution-${Date.now()}.log`
                    a.click()
                    setNotice('Logs exported.')
                  }}>
                    <Icon name="download" size={11}/> Export
                  </button>
                  <button className="btn-danger btn-sm" onClick={handleClearLogs}>
                    Clear Logs
                  </button>
                </div>
              </div>

              {/* Log Filters & Search Bar */}
              <div className="layout-131">
                <div className="layout-132">
                  <Icon name="search" size={13}/>
                  <input
                    className="layout-133"
                    placeholder="Search logs..."
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                  />
                </div>

                <div className="layout-134"/>

                <div className="layout-135">
                  <span className="layout-136">Stage:</span>
                  {['ALL', 'SYSTEM', 'CLEARANCE', 'AST_ANALYSIS', 'DEPENDENCY_SCAN', 'REPRO_TEST', 'FUZZING', 'MERGE_GATE', 'SANDBOX'].map(st => (
                    <button
                      key={st}
                      className={(`chip ${logStageFilter === st ? 'chip-green' : ''}`) + ' layout-137'}

                      onClick={() => setLogStageFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="layout-138">
                  <span className="layout-139">Level:</span>
                  {['ALL', 'INFO', 'WARN', 'ERROR', 'PASS'].map(lv => (
                    <button
                      key={lv}
                      className={(`chip ${logLevelFilter === lv ? 'chip-blue' : ''}`) + ' layout-140'}

                      onClick={() => setLogLevelFilter(lv)}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Terminal Window */}
              <div className="layout-141">
                {filteredLogs.map(log => (
                  <div key={log.id} className="log-entry layout-142" >
                    <span className="layout-143">[{log.timestamp}]</span>
                    <span className="chip layout-144" >
                      {log.stage}
                    </span>
                    <span className={(`chip ${log.level === 'PASS' ? 'chip-green' : log.level === 'WARN' ? 'chip-amber' : log.level === 'ERROR' || log.level === 'ALERT' ? 'chip-red' : 'chip-blue'}`) + ' layout-145'} >
                      {log.level}
                    </span>
                    <span className="layout-146">{log.message}</span>
                  </div>
                ))}
                {!filteredLogs.length && (
                  <div className="layout-147">
                    No execution log entries match the current filters.
                  </div>
                )}
                <div className="layout-148">
                  <span className="cursor">▍</span>
                </div>
              </div>
            </div>
          )}



          {/* ════════════════════════════════════════════════════════════════
              TAB: SETTINGS (UNIFIED CONFIGURATION)
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Settings' && (
            <div className="layout-149">
              {/* Settings Subnav Tabs */}
              <div className="layout-150">
                <div>
                  <h3 className="layout-151">
                    <Icon name="settings" size={15}/> System Configuration & Clearance Policies
                  </h3>
                  <p className="layout-152">
                    Manage zero-trust verification rules, AI inference models, and webhook endpoints.
                  </p>
                </div>
                <div className="layout-153">
                  <button
                    className={`btn-secondary btn-sm ${settingsSubTab === 'rules' ? 'chip-green' : ''}`}
                    onClick={() => setSettingsSubTab('rules')}
                  >
                    <Icon name="shield" size={11}/> Verification Rules
                  </button>
                  <button
                    className={`btn-secondary btn-sm ${settingsSubTab === 'models' ? 'chip-blue' : ''}`}
                    onClick={() => setSettingsSubTab('models')}
                  >
                    <Icon name="activity" size={11}/> AI Inference & Models
                  </button>
                  <button
                    className={`btn-secondary btn-sm ${settingsSubTab === 'repo' ? 'chip-amber' : ''}`}
                    onClick={() => setSettingsSubTab('repo')}
                  >
                    <Icon name="settings" size={11}/> Webhook & Sandbox
                  </button>
                </div>
              </div>

              {/* ── SubTab 1: Verification Rules ── */}
              {settingsSubTab === 'rules' && (
                <div className="layout-154">
                  <div className="layout-155">
                    <span className="layout-156">Zero-Trust Cryptographic & AST Clearance Policies</span>
                    <div className="layout-157">
                      <button className="btn-secondary btn-sm" onClick={() => {
                        setConfig({
                          ...config,
                          verification_rules: {
                            min_trust_score: 80,
                            auto_quarantine_first_timers: true,
                            blast_radius_threshold: 50,
                            block_slopsquatting: true,
                            fuzzing_mutation_count: 128,
                            strict_mode: true,
                          }
                        })
                        setNotice('Reset rules to defaults.')
                      }}>
                        Reset Defaults
                      </button>
                      <button className="btn-primary btn-sm" disabled={cfgSaving} onClick={() => handleSaveConfig('verification_rules')}>
                        <Icon name="check" size={11}/> {cfgSaving ? 'Saving…' : 'Save Rules'}
                      </button>
                      {savedSuccessSection === 'verification_rules' && (
                        <span className="chip chip-green">✓ Saved</span>
                      )}
                    </div>
                  </div>

                  <div className="layout-158">
                    <div className="layout-159">
                      <div className="layout-160">CONTRIBUTOR REPUTATION GATE</div>
                      <div className="form-field layout-161" >
                        <div className="layout-162">
                          <label className="layout-163">Minimum Fast-Track Trust Score</label>
                          <span className="chip chip-green layout-164" >{config.verification_rules.min_trust_score} / 100</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={config.verification_rules.min_trust_score}
                          onChange={e => setConfig({
                            ...config,
                            verification_rules: { ...config.verification_rules, min_trust_score: Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div className="layout-165">
                        <div>
                          <strong className="layout-166">Auto-Quarantine First-Time & Bot Accounts</strong>
                          <div className="layout-167">
                            Zero-trust hold on unverified personas until maintainer review.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.verification_rules.auto_quarantine_first_timers}
                            onChange={e => setConfig({
                              ...config,
                              verification_rules: { ...config.verification_rules, auto_quarantine_first_timers: e.target.checked }
                            })}
                          />
                          <span className="slider"/>
                        </label>
                      </div>
                    </div>

                    <div className="layout-168">
                      <div className="layout-169">CODE AUDIT & SLOP DEFENSE</div>
                      <div className="form-field layout-170" >
                        <div className="layout-171">
                          <label className="layout-172">AST Blast Radius Threshold</label>
                          <span className="chip chip-blue layout-173" >&le; &Delta;{config.verification_rules.blast_radius_threshold} statements</span>
                        </div>
                        <input
                          type="number"
                          value={config.verification_rules.blast_radius_threshold}
                          onChange={e => setConfig({
                            ...config,
                            verification_rules: { ...config.verification_rules, blast_radius_threshold: Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div className="layout-174">
                        <div>
                          <strong className="layout-175">Strict PyPI Slopsquatting Protection</strong>
                          <div className="layout-176">
                            Rejects unindexed packages & hallucinated AI dependencies.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.verification_rules.block_slopsquatting}
                            onChange={e => setConfig({
                              ...config,
                              verification_rules: { ...config.verification_rules, block_slopsquatting: e.target.checked }
                            })}
                          />
                          <span className="slider"/>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SubTab 2: AI Model & Inference ── */}
              {settingsSubTab === 'models' && (
                <div className="layout-177">
                  <div className="layout-178">
                    <span className="layout-179">LLM Inference Engine & Open-Weight Reasoning Configuration</span>
                    <div className="layout-180">
                      <button className="btn-secondary btn-sm" disabled={llmTesting} onClick={handleTestLLM}>
                        <Icon name="activity" size={11}/> {llmTesting ? 'Pinging LLM…' : 'Test LLM Connection'}
                      </button>
                      <button className="btn-primary btn-sm" disabled={cfgSaving} onClick={() => handleSaveConfig('ai_model_config')}>
                        <Icon name="check" size={11}/> {cfgSaving ? 'Saving…' : 'Save Model Settings'}
                      </button>
                      {savedSuccessSection === 'ai_model_config' && (
                        <span className="chip chip-green">✓ Saved</span>
                      )}
                    </div>
                  </div>

                  {llmTestStatus && (
                    <div className="chip chip-green layout-181" >
                      ✓ {llmTestStatus}
                    </div>
                  )}

                  <div className="layout-182">
                    <div className="layout-183">
                      <div className="layout-184">ACTIVE INFERENCE BACKEND</div>
                      <div className="form-field layout-185" >
                        <label className="layout-186">Primary Code Model</label>
                        <select
                          value={config.model_config.model_name}
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, model_name: e.target.value }
                          })}
                        >
                          <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended · Groq)</option>
                          <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-Fast · Groq)</option>
                          <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                          <option value="gemma2-9b-it">Gemma 2 9B (Groq)</option>
                          <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill Llama 70B (Groq)</option>
                        </select>
                      </div>
                      <div className="form-field layout-187" >
                        <label className="layout-188">Inference Endpoint URL</label>
                        <input
                          value={config.model_config.inference_endpoint}
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, inference_endpoint: e.target.value }
                          })}
                        />
                      </div>
                      <div className="form-field layout-189" >
                        <label className="layout-190">API Key / Bearer Token</label>
                        <input
                          type="password"
                          value={config.model_config.api_key}
                          placeholder="gsk_••••••••"
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, api_key: e.target.value }
                          })}
                        />
                      </div>
                    </div>

                    <div className="layout-191">
                      <div className="layout-192">REASONING PARAMETERS</div>
                      <div className="form-field layout-193" >
                        <div className="layout-194">
                          <label className="layout-195">Sampling Temperature</label>
                          <span className="chip chip-amber layout-196" >{config.model_config.temperature}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={config.model_config.temperature}
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, temperature: Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div className="form-field layout-197" >
                        <label className="layout-198">Context Window Capacity</label>
                        <select
                          value={config.model_config.context_window}
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, context_window: e.target.value }
                          })}
                        >
                          <option value="16k">16,384 tokens (Fast)</option>
                          <option value="32k">32,768 tokens (Default)</option>
                          <option value="64k">65,536 tokens (Full Repo Context)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SubTab 3: Repository, Webhook & Governance ── */}
              {settingsSubTab === 'repo' && (
                <div className="layout-199">
                  <div className="layout-200">
                    <span className="layout-201">Webhook Endpoint Security & Sandbox Execution Limits</span>
                    <div className="layout-202">
                      <button className="btn-secondary btn-sm" onClick={() => {
                        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'ghostrepro-config.json'
                        a.click()
                        setNotice('Configuration exported as JSON.')
                      }}>
                        Export JSON
                      </button>
                      <button className="btn-primary btn-sm" disabled={cfgSaving} onClick={() => handleSaveConfig('repo_settings')}>
                        <Icon name="check" size={11}/> {cfgSaving ? 'Saving…' : 'Save Settings'}
                      </button>
                      {savedSuccessSection === 'repo_settings' && (
                        <span className="chip chip-green">✓ Saved</span>
                      )}
                    </div>
                  </div>

                  <div className="layout-203">
                    <div className="layout-204">
                      <div className="layout-205">GITHUB WEBHOOK RECEIVER</div>
                      <div className="form-field layout-206" >
                        <label className="layout-207">Target Webhook URL</label>
                        <div className="layout-208">
                          <input readOnly value={config.repo_settings.webhook_url} className="layout-209"/>
                          <button className="btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(config.repo_settings.webhook_url); setNotice('Webhook URL copied!') }}>
                            <Icon name="copy" size={11}/>
                          </button>
                          <button className="btn-primary btn-sm" onClick={handlePingWebhook}>Ping</button>
                        </div>
                      </div>
                      <div className="form-field layout-210" >
                        <label className="layout-211">Webhook Secret Token</label>
                        <div className="layout-212">
                          <input
                            value={config.repo_settings.webhook_secret}
                            placeholder="whsec_••••••••"
                            onChange={e => setConfig({
                              ...config,
                              repo_settings: { ...config.repo_settings, webhook_secret: e.target.value }
                            })}
                            className="layout-213"
                          />
                          <button className="btn-secondary btn-sm" onClick={async () => {
                            try {
                              const res = await regenerateWebhookSecret()
                              setConfig(prev => ({
                                ...prev,
                                repo_settings: { ...prev.repo_settings, webhook_secret: res.webhook_secret }
                              }))
                              setNotice('✅ Cryptographically secure webhook secret generated and saved.')
                            } catch (err: any) {
                              setNotice(`❌ Failed to regenerate secret: ${err?.message || 'Server error'}`)
                            }
                          }}>
                            Regen
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="layout-214">
                      <div className="layout-215">EXECUTION & MERGE GATE</div>
                      <div className="layout-216">
                        <div>
                          <strong className="layout-217">Auto-Merge on Full Verification Pass</strong>
                          <div className="layout-218">
                            Merges PRs passing RED&rarr;GREEN proofs and surviving fuzzing.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.repo_settings.auto_merge_on_pass}
                            onChange={e => setConfig({
                              ...config,
                              repo_settings: { ...config.repo_settings, auto_merge_on_pass: e.target.checked }
                            })}
                          />
                          <span className="slider"/>
                        </label>
                      </div>
                      <div className="form-field layout-219" >
                        <div className="layout-220">
                          <label className="layout-221">Sandbox Execution Timeout</label>
                          <span className="chip chip-blue layout-222" >{config.repo_settings.sandbox_timeout_sec} seconds</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="120"
                          value={config.repo_settings.sandbox_timeout_sec}
                          onChange={e => setConfig({
                            ...config,
                            repo_settings: { ...config.repo_settings, sandbox_timeout_sec: Number(e.target.value) }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="layout-223">
                    <div className="layout-224">
                      <Icon name="alert" size={14}/>
                      <div>
                        <strong className="layout-225">Danger Zone · Purge Session & Simulation Data</strong>
                        <div className="layout-226">Permanently resets PR queue, bug proofs, and simulation data to zero state.</div>
                      </div>
                    </div>
                    <button className="btn-danger btn-sm" onClick={handleResetAllData}>
                      Purge All Session Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          <footer className="main-footer">
            <span><Icon name="shield" size={13}/> Zero-trust verification engine for open-source repositories</span>
            <span><i className="dot"/> Sandboxed pytest runtime <span className="footer-sep">/</span> {activeRepo ? `Target: ${activeRepo}` : 'No active repository'}</span>
          </footer>
        </main>
      </div>

      {/* ── Bottom Terminal Bar ── */}
      <button className="terminal-bar" onClick={() => setTerminal(!terminal)}>
        <span>
          <Icon name="terminal" size={15}/>
          <b>Sandbox console</b>
          <span className="dot"/>
          <span>sbx_8f2a91</span>
          <span className="console-last">
            {executionLogs[executionLogs.length - 1]?.message || 'Zero-trust gatekeeper listening…'}
          </span>
        </span>
        <span>Live <span className="keyboard">⌃ `</span> <span>⌃</span></span>
      </button>

      {/* ── Toast Notification ── */}
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <Icon name="check" size={16}/>
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="close" size={14}/></button>
        </div>
      )}

      {/* ── Terminal Drawer ── */}
      {terminal && (
        <div className="drawer">
          <div className="drawer-header">
            <span>
              <Icon name="terminal"/> Sandbox execution <span className="processing"><i/> Live</span>
            </span>
            <div>
              <button onClick={() => {
                const txt = executionLogs.map(l => `[${l.timestamp}] [${l.stage}] ${l.message}`).join('\n')
                navigator.clipboard?.writeText(txt)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}>
                <Icon name="copy" size={15}/>{copied ? 'Copied' : 'Copy logs'}
              </button>
              <button aria-label="Close execution logs" onClick={() => setTerminal(false)}><Icon name="close"/></button>
            </div>
          </div>
          <div className="terminal-meta">sbx_8f2a91 <span>/</span> {activeRepo || 'no-repo'} <span>/</span> Python 3.12 · pytest 8.3.2</div>
          <pre>
            {executionLogs.slice(-8).map(l => `[${l.timestamp}] ${l.stage}: ${l.message}`).join('\n')}
            <span className="cursor">▍</span>
          </pre>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          GITHUB AUTHORIZATION & INTERACTIVE REPOSITORIES MODAL
         ════════════════════════════════════════════════════════════════ */}
      {githubModalOpen && (
        <div className="modal-overlay" onClick={() => setGithubModalOpen(false)}>
          <div className="modal-content layout-227"  onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="github" size={18}/> GitHub Authorization & Connected Repositories</h3>
              <button className="icon-button" onClick={() => setGithubModalOpen(false)}><Icon name="close" size={16}/></button>
            </div>
            <div className="modal-body">
              {/* Account Status Card */}
              <div className="layout-228">
                <span className="avatar me layout-229" >
                  {initials(githubUser.username)}
                </span>
                <div className="layout-230">
                  <div className="layout-231">
                    <strong className="layout-232">
                      {githubUser.authenticated ? (githubUser.name || githubUser.username) : 'Not Authorized'}
                    </strong>
                    <span className={`chip ${githubUser.authenticated ? 'chip-green' : 'chip-amber'}`}>
                      {githubUser.authenticated ? 'AUTHORIZED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="layout-233">
                    {githubUser.authenticated ? (
                      `@${githubUser.username} · ${repos.length} Repositories Connected`
                    ) : (
                      'Enter your GitHub handle below to connect and inspect your repositories.'
                    )}
                  </div>
                </div>
              </div>

              {/* Authorize Token / Handle Input */}
              <div className="layout-234">
                <div className="layout-235">
                  <div className="form-field layout-236" >
                    <label>GitHub Username</label>
                    <input
                      value={githubUsernameInput}
                      onChange={e => setGithubUsernameInput(e.target.value)}
                      placeholder="e.g. asfandkhan8585-cpu or your-handle"
                    />
                  </div>
                  <div className="form-field layout-237" >
                    <label>Personal Access Token (PAT) [Required to approve & merge PRs on GitHub]</label>
                    <input
                      type="password"
                      value={githubPatInput}
                      onChange={e => setGithubPatInput(e.target.value)}
                      placeholder="ghp_... or gho_... (needs 'repo' write scope)"
                    />
                  </div>
                </div>
                <div className="layout-238">
                  <span className="layout-239">
                    Authorizing loads your authentic repositories from GitHub.
                  </span>
                  <button className="btn-primary btn-sm" onClick={handleAuthorizeGitHub}>
                    <Icon name="check" size={13}/> Authorize & Sync Repos
                  </button>
                </div>
              </div>

              {/* Add Custom Repository Section */}
              <div className="layout-240">
                <strong className="layout-241">+ Connect New Custom Repository</strong>
                <form onSubmit={handleAddCustomRepo} className="layout-242">
                  <input
                    className="layout-243"
                    placeholder="Repo name (e.g. backend-api)"
                    value={newRepoName}
                    onChange={e => setNewRepoName(e.target.value)}
                  />
                  <input
                    className="layout-244"
                    placeholder="Description (optional)"
                    value={newRepoDesc}
                    onChange={e => setNewRepoDesc(e.target.value)}
                  />
                  <select
                    className="layout-245"
                    value={newRepoLang}
                    onChange={e => setNewRepoLang(e.target.value)}
                  >
                    <option value="Python">Python</option>
                    <option value="TypeScript">TypeScript</option>
                    <option value="Go">Go</option>
                    <option value="Rust">Rust</option>
                  </select>
                  <button type="submit" className="btn-secondary btn-sm">+ Add</button>
                </form>
              </div>

              {/* Connected Repositories Grid */}
              <div>
                <div className="layout-246">
                  <strong className="layout-247">Connected Repositories ({repos.length})</strong>
                  <button className="btn-secondary btn-sm" onClick={handleSyncRepos} disabled={isSyncing}>
                    <Icon name="sync" size={12} className={isSyncing ? "spin-anim" : ""} />
                    <span>{isSyncing ? "Refreshing…" : "Refresh Repos"}</span>
                  </button>
                </div>

                <div className="layout-248">
                  {repos.map(r => (
                    <div
                      key={r.id}
                      style={{
                        padding: '12px 14px',
                        background: r.full_name === activeRepo ? 'var(--ui-1f3427)' : 'var(--ui-141d18)',
                        border: `1px solid ${r.full_name === activeRepo ? 'var(--ui-4b7557)' : 'var(--ui-2b3b30)'}`,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div className="layout-249">
                        <div className="layout-250">
                          <strong className="layout-251">{r.full_name}</strong>
                          {r.is_private && <span className="chip chip-amber">PRIVATE</span>}
                          {r.full_name === activeRepo && <span className="chip chip-green">ACTIVE</span>}
                        </div>
                        <div className="layout-252">
                          {r.description}
                        </div>
                        <div className="layout-253">
                          <span>★ {r.stars}</span>
                          <span>Forks: {r.forks}</span>
                          <span>Open PRs: {r.open_prs}</span>
                          <span>Repros: {r.repro_tests}</span>
                          <span>{r.language}</span>
                        </div>
                      </div>

                      <div className="layout-254">
                        <button
                          className="btn-secondary btn-sm"
                          title="Simulate an incoming PR on this repository"
                          onClick={() => handleSimulateIncomingPR(r.full_name)}
                        >
                          + Fetch PRs
                        </button>
                        {r.full_name === activeRepo ? (
                          <span className="chip chip-green">CURRENT</span>
                        ) : (
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => {
                              handleSelectRepo(r.id)
                              setGithubModalOpen(false)
                            }}
                          >
                            Switch To
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {repos.length === 0 && (
                    <div className="layout-255">
                      No repositories connected yet. Enter your GitHub username above or use "+ Connect New Custom Repository".
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setGithubModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          NEW BUG REPRODUCTION MODAL
         ════════════════════════════════════════════════════════════════ */}
      {newReproModalOpen && (
        <div className="modal-overlay" onClick={() => setNewReproModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="bug" size={18}/> Generate Autonomous Bug Reproduction Test</h3>
              <button className="icon-button" onClick={() => setNewReproModalOpen(false)}><Icon name="close" size={16}/></button>
            </div>
            <form onSubmit={handleCreateRepro}>
              <div className="modal-body">
                <div className="form-field">
                  <label>Issue Number</label>
                  <input
                    type="number"
                    value={newIssueNumber}
                    onChange={e => setNewIssueNumber(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Issue Title / Description</label>
                  <input
                    value={newIssueTitle}
                    onChange={e => setNewIssueTitle(e.target.value)}
                    placeholder="e.g. Payment retry causes double charge on Stripe webhook timeout"
                    required
                  />
                </div>
                <div className="layout-256">
                  <strong>Autonomous Pipeline:</strong> Llama-3.3-70B on Groq LPU analyzes codebase AST context, generates a standalone <code>test_repro_{newIssueNumber}.py</code>, and executes it in an ephemeral sandbox to verify the test is initially RED.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setNewReproModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Generate Repro Test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW PYTEST CODE DRAWER
         ════════════════════════════════════════════════════════════════ */}
      {codeDrawer?.open && (
        <div className="modal-overlay" onClick={() => setCodeDrawer(null)}>
          <div className="modal-content layout-257"  onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="terminal" size={18}/> {codeDrawer.file} (Issue #{codeDrawer.issue})</h3>
              <button className="icon-button" onClick={() => setCodeDrawer(null)}><Icon name="close" size={16}/></button>
            </div>
            <div className="modal-body">
              <pre className="layout-258">
                {codeDrawer.code}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(codeDrawer.code); setNotice('Pytest code copied to clipboard!') }}>
                <Icon name="copy" size={13}/> Copy Code
              </button>
              <button className="btn-primary" onClick={() => { handleRunIssueRepro(codeDrawer.issue); setCodeDrawer(null) }}>
                <Icon name="play" size={13}/> Execute in Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          NOTIFICATIONS POPOVER
         ════════════════════════════════════════════════════════════════ */}
      {notificationsOpen && (
        <div className="modal-overlay" onClick={() => setNotificationsOpen(false)}>
          <div className="modal-content layout-259"  onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="bell" size={16}/> System Notifications</h3>
              <button className="icon-button" onClick={() => setNotificationsOpen(false)}><Icon name="close" size={14}/></button>
            </div>
            <div className="modal-body layout-260" >
              {events.length > 0 ? (
                events.slice(0, 6).map(evt => (
                  <div key={evt.id} className="layout-261">
                    <div className="layout-262">
                      <span>{evt.stage}</span>
                      <span>{timeAgo(evt.timestamp)}</span>
                    </div>
                    <div className="layout-263">{evt.message}</div>
                  </div>
                ))
              ) : (
                <div className="layout-264">
                  No notifications yet.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary btn-sm" onClick={() => setNotificationsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── PR Table Row Component ─────────────────────────────────────────── */
function Row({ row: r, expanded, toggle, timeAgo, mapStatus, badgeClass, scoreClass, initials }: {
  row: PRRecord
  expanded: boolean
  toggle: () => void
  timeAgo: (iso: string) => string
  mapStatus: (s: string) => string
  badgeClass: (s: string) => string
  scoreClass: (v: number) => string
  initials: (n: string) => string
}) {
  return (
    <>
      <tr className={expanded ? 'expanded' : ''} onClick={toggle}>
        <td>
          <div className="pr-title">
            <a href={`#pr-${r.number}`} onClick={e => e.preventDefault()}>#{r.number}</a>
            <strong>{r.title}</strong>
          </div>
          <div className="author">
            <span className="author-icon">{initials(r.author)}</span>
            {r.author}<span>·</span>{timeAgo(r.created_at)}
          </div>
        </td>
        <td><span className={`badge ${badgeClass(r.status)}`}><i/>{mapStatus(r.status)}</span></td>
        <td>
          <span className={`score ${scoreClass(r.trust_score)}`}>{r.trust_score}<small>/100</small></span>
          <div className="score-track"><span style={{ width: `${r.trust_score}%` }} className={scoreClass(r.trust_score)}/></div>
        </td>
        <td>
          {r.blast_radius ? (
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: (r.blast_radius.statement_delta > 50) ? 'var(--ui-ff7b72)' : 'var(--ui-56d364)' }}>
              Δ{r.blast_radius.statement_delta} {r.blast_radius.scope_creep_detected && '⚠'}
            </span>
          ) : (
            <span className="layout-265">-</span>
          )}
        </td>
        <td>
          <button className={`expand ${expanded ? 'rotated' : ''}`} aria-label={`Expand PR ${r.number}`}><Icon name="arrow" size={15}/></button>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={5}>
            <Icon name="shield" size={14}/>
            <span>
              {r.test_result ? (r.test_result.passed ? '✅ All tests passed.' : '❌ Tests failed.') : '⏳ Awaiting execution.'}
              {' '}Tier: {r.tier} · Blast radius: Δ{r.blast_radius?.statement_delta ?? '?'} statements
              {r.blast_radius?.scope_creep_detected && ' · ⚠ Scope creep detected'}
            </span>
          </td>
        </tr>
      )}
    </>
  )
}
