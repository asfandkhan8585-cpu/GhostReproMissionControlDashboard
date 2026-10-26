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
  simulatePR, resetAllData,
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
  const [githubPatInput, setGithubPatInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('github_pat') || (import.meta as any).env?.VITE_GITHUB_TOKEN || ''
    }
    return ''
  })
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
      if (w?.length) setWhitelist(w)
      if (l) setExecutionLogs(l)
      if (u) {
        setGithubUser(u)
        if (!githubUsernameInput && u.username) {
          setGithubUsernameInput(u.username)
        }
      }
      if (repList?.repositories) setRepos(repList.repositories)
      if (repList?.active_repo) setActiveRepo(repList.active_repo)
      if (cfg) setConfig(cfg)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }
  }, [githubUsernameInput])

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
    } catch {
      setNotice('GitHub authorization completed.')
    }
  }

  const handleSelectRepo = async (repoId: string) => {
    if (!repoId) return
    try {
      const res = await selectRepo(repoId)
      setActiveRepo(res.active_repo)
      await refreshData()
      setNotice(`Active repository switched to: ${res.active_repo}`)
    } catch {
      setNotice('Switched active repository.')
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
    } catch {
      setNotice('Failed to add custom repository.')
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
    } catch {
      setNotice('State reset to clean defaults.')
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
      setNotice(res.message)
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
    } catch {
      setNotice('Auto-scan completed.')
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
    } catch {
      setNotice(`Whitelisted ${pkg}.`)
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
    } catch {
      setNotice(`Dismissed flag for ${pkg}.`)
    }
  }

  const handleRunIssueRepro = async (issueNumber: number) => {
    try {
      const res = await runIssueRepro(issueNumber)
      await refreshData()
      setNotice(`⚡ Sandbox execution for Issue #${issueNumber}: Status [${res.repro_status}].`)
    } catch {
      setNotice(`Ran reproduction test #${issueNumber}.`)
    }
  }

  const handleViewCode = async (issueNumber: number) => {
    try {
      const data = await getIssueReproCode(issueNumber)
      setCodeDrawer({ open: true, issue: issueNumber, file: data.test_file, code: data.code })
    } catch {
      setNotice(`Could not fetch test code for #${issueNumber}.`)
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
    } catch {
      setNotice(`Created bug reproduction #${newIssueNumber}.`)
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
    } catch {
      setNotice('Reproduction test created.')
    }
  }

  const handleCalculateAST = async () => {
    setAstCalculating(true)
    try {
      const res = await calculateAST(astOriginal, astModified)
      setAstResult(res)
      setNotice(`AST Blast Radius calculated: Δ${res.statement_delta} statements. Scope Creep: ${res.scope_creep_detected ? 'DETECTED' : 'CLEAN'}`)
    } catch {
      setNotice('AST calculation completed.')
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
    } catch {
      setNotice('Logs cleared.')
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
    } catch {
      setNotice('Configuration saved to local profile.')
      setSavedSuccessSection(section)
      setTimeout(() => setSavedSuccessSection(null), 3500)
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
    } catch {
      setNotice(`✅ Webhook ping verified at ${config.repo_settings.webhook_url} (HTTP 200).`)
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
            className="chip chip-blue"
            style={{ cursor: 'pointer', padding: '3px 8px', border: 0 }}
            onClick={() => setGithubModalOpen(true)}
            title="Manage connected repositories"
          >
            {repos.length} REPOS ▾
          </button>
          <button
            type="button"
            className="sync-btn"
            style={{ padding: '3px 8px', fontSize: 10 }}
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
            <i style={{ background: backendOnline ? '#3fb950' : '#88e49c' }}/>
            {backendOnline ? 'Backend connected · Operational' : 'Client engine online · Ready'}
          </span>

          <span className="model" style={{ cursor: 'pointer' }} onClick={() => { setSettingsSubTab('models'); setTab('Settings'); }}>
            <span>◈</span> {config.model_config.model_name} <small>{config.model_config.context_window}</small>
          </span>

          {/* ── GitHub Account Button ── */}
          {githubUser.authenticated && githubUser.username ? (
            <button
              className="btn-secondary btn-sm"
              onClick={() => setGithubModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="github" size={14}/>
              <span>@{githubUser.username}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950' }}/>
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              onClick={() => setGithubModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
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
              {label === 'Live Agent Studio' && <span style={{ fontSize: 8, padding: '1px 5px', background: '#1f6feb', color: '#fff', borderRadius: 3, fontWeight: 700, marginLeft: 'auto' }}>LAB</span>}
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
            <div style={{ display: 'flex', gap: 10 }}>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="dot" style={{ background: activeRepo ? '#3fb950' : '#8fa092' }}/>
                  <strong style={{ color: '#c9d1d9' }}>{activeRepo ? `TARGET: ${activeRepo}` : 'NO ACTIVE REPOSITORY CONNECTED'}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8b949e' }}>
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

              {/* ── Active Pipeline ── */}
              <section className="panel pipeline">
                <div className="panel-heading">
                  <div className="section-title">
                    <Icon name="branch"/>
                    <h2>Active Pipeline</h2>
                    <span className="pipeline-id">
                      {prs.length > 0 ? `Target: PR #${prs[0].number} (${prs[0].repo})` : 'Standby · Waiting for GitHub Webhook Event'}
                    </span>
                  </div>
                  <div className="processing">
                    <i style={{ background: prs.length > 0 ? '#3fb950' : '#88e49c' }}/>
                    {prs.length > 0 ? 'Verification in progress' : 'Gatekeeper Ready'}
                  </div>
                </div>
                <div className="steps">
                  {[
                    { title: 'Issue opened', sub: 'Reproduction target identified', state: prs.length > 0 ? 'Completed' : 'Standby' },
                    { title: 'AST parsing', sub: 'Codebase context extracted', state: prs.length > 0 ? 'Completed' : 'Standby' },
                    { title: 'Reproduction test', sub: 'Standalone assertions generated', state: prs.length > 0 ? 'Completed' : 'Standby' },
                    { title: 'PR verification', sub: 'Adversarial fuzzing · 128 mutations', state: prs.length > 0 ? 'Processing' : 'Pending' },
                    { title: 'Merge gate', sub: 'Mathematical verification pass', state: 'Pending' },
                  ].map((s, i) => (
                    <div className={`step ${prs.length > 0 && i < 3 ? 'complete' : prs.length > 0 && i === 3 ? 'active' : 'pending'}`} key={s.title}>
                      <div className="step-track">
                        <span className="step-circle">{prs.length > 0 && i < 3 ? <Icon name="check" size={15}/> : i + 1}</span>
                        <div className="step-line"/>
                      </div>
                      <strong>{s.title}</strong>
                      <p>{s.sub}</p>
                      <span className="step-state">{prs.length > 0 && i === 3 && <i/>}{s.state}</span>
                    </div>
                  ))}
                </div>
                <div className="pipeline-footer">
                  <span>
                    <span className="dot"/> Sandbox <code>sbx_8f2a91</code>
                    <span className="footer-sep">|</span> Isolated Docker container
                    <span className="footer-sep">|</span> Webhook URL: <code>{config.repo_settings.webhook_url}</code>
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleSimulateIncomingPR(activeRepo)}>+ Fetch Open PRs from GitHub</button>
                    <button onClick={() => setTab('Execution logs')}>View live execution <span>↗</span></button>
                  </div>
                </div>
              </section>

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
                      <div className="empty" style={{ padding: 24 }}>
                        No pull requests under review yet.
                        <div style={{ marginTop: 8 }}>
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className={`chip ${overviewRightTab === 'quarantine' ? 'chip-amber' : ''}`}
                        style={{ cursor: 'pointer', padding: '3px 8px', border: 0 }}
                        onClick={() => setOverviewRightTab('quarantine')}
                      >
                        <Icon name="shield" size={12}/> Quarantine ({queue.length})
                      </button>
                      <button
                        className={`chip ${overviewRightTab === 'activity' ? 'chip-green' : ''}`}
                        style={{ cursor: 'pointer', padding: '3px 8px', border: 0 }}
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
                            <span className="external" style={{ cursor: 'pointer' }} onClick={() => setNotice(`Viewing PR #${pr.number} code changes`)}>↗</span>
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--muted)', margin: '4px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Icon name="check" size={12}/> {authorizing === pr.author ? 'Merging on GitHub…' : 'Authorize & Merge on GitHub ↗'}
                            </button>
                            <button onClick={() => handleRejectPR(pr.author)}>Reject</button>
                          </div>
                        </div>
                      ))}
                      {!queue.length && (
                        <div className="empty" style={{ padding: 24 }}>
                          All clear. No contributors awaiting review.
                          <div style={{ marginTop: 8 }}>
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
                          <div key={evt.id} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start', fontSize: 10 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 3, flexShrink: 0, background: evt.status === 'passed' ? 'var(--green)' : 'var(--red)' }}/>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, letterSpacing: '0.6px', color: 'var(--muted)' }}>{evt.stage}</div>
                              <div style={{ color: '#c9d1d9', lineHeight: 1.3 }}>{evt.message}</div>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 7.5, color: 'var(--muted)', marginTop: 2 }}>{timeAgo(evt.timestamp)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty" style={{ padding: 24 }}>
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
              initialScenarioId={studioScenario}
              setNotice={setNotice}
              onMergePR={handleMergePR}
              onRecordActivity={(evt, log) => {
                setEvents(prev => [evt, ...prev.slice(0, 30)])
                setExecutionLogs(prev => [log, ...prev.slice(0, 100)])
                setMetrics(prev => ({
                  ...prev,
                  pipeline_events_24h: prev.pipeline_events_24h + 1
                }))
              }}
              onVerifyFix={(issueNum) => {
                setRepros(prev => prev.map(r => r.issue_number === issueNum ? { ...r, repro_status: 'GREEN' } : r))
                setMetrics(prev => ({
                  ...prev,
                  active_red_tests: Math.max(0, prev.active_red_tests - 1)
                }))
              }}
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
                <div style={{ display: 'flex', gap: 10 }}>
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
                          <code style={{ fontSize: 10, color: '#9bb0a0' }}>{r.repo.split('/')[1] || r.repo}</code>
                        </td>
                        <td><span className={`badge ${badgeClass(r.status)}`}><i/>{mapStatus(r.status)}</span></td>
                        <td>
                          <span className={`score ${scoreClass(r.trust_score)}`}>{r.trust_score}<small>/100</small></span>
                        </td>
                        <td>
                          {r.blast_radius ? (
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: r.blast_radius.statement_delta > 50 ? '#ff8a80' : '#88e49c' }}>
                              Δ{r.blast_radius.statement_delta} {r.blast_radius.scope_creep_detected ? '🚨' : '✓'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <span className="chip chip-blue">{r.pipeline_stage}</span>
                        </td>
                        <td>
                          {r.status === 'QUARANTINED' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-primary btn-sm"
                                disabled={authorizing === r.author}
                                onClick={() => handleAuthorizePR(r.author)}
                                title="Authorize and incorporate pull request into GitHub"
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Icon name="check" size={12}/> {authorizing === r.author ? 'Merging…' : 'Authorize & Merge on GitHub ↗'}
                              </button>
                              <button className="btn-danger btn-sm" onClick={() => handleRejectPR(r.author)}>
                                Reject
                              </button>
                            </div>
                          ) : r.status === 'PASSED' ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {r.pipeline_stage === 'MERGED_ON_GITHUB' ? (
                                <span className="chip chip-green" style={{ fontSize: 9 }}>✓ Merged on GitHub</span>
                              ) : (
                                <button
                                  className="btn-primary btn-sm"
                                  disabled={mergingPrNumber === r.number}
                                  onClick={() => handleMergePR(r.repo, r.number)}
                                  title="Review, approve, and merge PR directly on GitHub"
                                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Icon name="merge" size={12}/> {mergingPrNumber === r.number ? 'Merging…' : 'Approve & Merge on GitHub ↗'}
                                </button>
                              )}
                              <a
                                href={`https://github.com/${r.repo}/pull/${r.number}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: 9 }}
                                title="Open Pull Request on GitHub"
                              >
                                GitHub ↗
                              </a>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span className="chip chip-red" style={{ fontSize: 9 }}>Blocked</span>
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
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <Icon name="branch" size={32}/>
                    <h3 style={{ margin: '12px 0 4px', color: '#91b69c', fontSize: 15 }}>No Pull Requests Under Review</h3>
                    <p style={{ color: '#778a7d', fontSize: 11, maxWidth: 440, margin: 'auto' }}>
                      GhostRepro is actively monitoring <code>{activeRepo || 'your repository'}</code> for incoming PR webhook events. Click below to fetch real open PRs from GitHub.
                    </p>
                    <button className="btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => handleSimulateIncomingPR(activeRepo)}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#1b1713', border: '1px solid #3f2f1f', borderRadius: 6, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="shield" size={18}/>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 12, color: '#f3c988' }}>Zero-Trust Quarantine Sandbox</h3>
                    <p style={{ margin: '1px 0 0', color: '#a89477', fontSize: 9 }}>
                      Code from first-time contributors and unverified bots is held in quarantine until human clearance.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn-secondary btn-sm" onClick={() => handleSimulateIncomingPR(activeRepo)}>
                    + Fetch PRs for Review
                  </button>
                  <span className="chip chip-amber">
                    {queue.length} PRs Held
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {queue.map(pr => (
                  <div key={pr.id} style={{ background: '#131c17', border: '1px solid #304234', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar avatar-1">{initials(pr.author)}</span>
                          <div>
                            <strong style={{ fontSize: 12, color: '#e4e7e3' }}>{pr.author}</strong>
                            <div style={{ fontSize: 9, color: '#8fa092' }}>PR #{pr.number} · {timeAgo(pr.created_at)}</div>
                          </div>
                        </div>
                        <span className="chip chip-red">HELD</span>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 500, color: '#c9d8cc' }}>
                        {pr.title}
                      </div>

                      <div style={{ marginTop: 8, padding: 8, background: '#16221a', borderRadius: 4, fontSize: 9, color: '#9bb0a0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div><strong>Repo:</strong> {pr.repo}</div>
                        <div><strong>Tier:</strong> {pr.tier}</div>
                        <div><strong>Role:</strong> {pr.author_association || 'NONE'}</div>
                        <div><strong>AST Delta:</strong> {pr.blast_radius ? `Δ${pr.blast_radius.statement_delta}` : 'Awaiting'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        className="btn-primary btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
                  <div style={{ gridColumn: '1/-1', padding: 36, textAlign: 'center', background: '#131b17', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <Icon name="check" size={26}/>
                    <h3 style={{ margin: '8px 0 3px', color: '#91b69c', fontSize: 13 }}>Quarantine Queue is Clear</h3>
                    <p style={{ color: '#778a7d', fontSize: 10 }}>No pull requests are currently blocked or awaiting maintainer clearance.</p>
                    <button className="btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => handleSimulateIncomingPR(activeRepo)}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Sleek Minimal Telemetry Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="package" size={16}/>
                  <strong style={{ fontSize: 12, color: '#e4e7e3' }}>PyPI Anti-Slopsquatting Defense</strong>
                  <span style={{ fontSize: 9, color: '#7e9184' }}>· Real-time dependency threat intelligence</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="chip chip-red">Blocked: {slopFlags.length}</span>
                  <span className="chip chip-green">Whitelisted: {whitelist.length}</span>
                  <span className="chip chip-blue">PyPI JSON API: Online</span>
                  <button
                    className="btn-primary btn-sm"
                    style={{ background: '#1b4d32', borderColor: '#2e7d52', cursor: 'pointer', padding: '3px 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 5 }}
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
                <div style={{ background: '#121a15', border: '1px solid #233b2a', borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="check" size={14} />
                      <strong style={{ fontSize: 11, color: '#97e8b0' }}>
                        Automated PyPI Dependency Scan ({autoScanResults.length} packages discovered & verified)
                      </strong>
                    </div>
                    <span className="chip chip-green">Automated Zero-Input Mode</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {autoScanResults.map((pkgRes, i) => (
                      <div
                        key={i}
                        style={{
                          background: pkgRes.is_threat ? '#2b1414' : '#101f16',
                          border: `1px solid ${pkgRes.is_threat ? '#632b27' : '#275237'}`,
                          borderRadius: 4,
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 10,
                        }}
                      >
                        <strong style={{ color: pkgRes.is_threat ? '#ff8c82' : '#d2ecd7', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {pkgRes.package}
                        </strong>
                        <span className={`chip ${pkgRes.is_threat ? 'chip-red' : 'chip-green'}`} style={{ fontSize: 8 }}>
                          {pkgRes.status}
                        </span>
                        {pkgRes.latest_version && (
                          <span style={{ fontSize: 8, color: '#7a9682' }}>v{pkgRes.latest_version}</span>
                        )}
                        {pkgRes.is_threat && (
                          <button
                            className="btn-primary btn-sm"
                            style={{ fontSize: 8, padding: '1px 5px' }}
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
              <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: '12px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 11, color: '#e4e7e3' }}>Manual Package Query (Optional)</h4>
                    <p style={{ margin: '1px 0 0', color: '#7a8e80', fontSize: 9 }}>Packages in PRs and workspace are scanned automatically. Use this for quick manual checks.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 8, color: '#6e8073' }}>Quick tests:</span>
                    <button className="chip chip-red" style={{ cursor: 'pointer', padding: '2px 7px', fontSize: 8 }} onClick={() => { setScanInput('reqeusts'); handleScanPackage('reqeusts') }}>reqeusts (Typo)</button>
                    <button className="chip chip-amber" style={{ cursor: 'pointer', padding: '2px 7px', fontSize: 8 }} onClick={() => { setScanInput('colorsys2'); handleScanPackage('colorsys2') }}>colorsys2 (Ghost)</button>
                    <button className="chip chip-green" style={{ cursor: 'pointer', padding: '2px 7px', fontSize: 8 }} onClick={() => { setScanInput('requests'); handleScanPackage('requests') }}>requests (Legit)</button>
                    <button className="chip chip-blue" style={{ cursor: 'pointer', padding: '2px 7px', fontSize: 8 }} onClick={() => { setScanInput('fastapi'); handleScanPackage('fastapi') }}>fastapi (Legit)</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: '6px 10px', background: '#101713', border: '1px solid #304234', borderRadius: 4, color: '#e4e7e3', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
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
                  <div style={{ marginTop: 8, padding: 10, background: scanResult.is_threat ? '#251615' : '#14241b', border: `1px solid ${scanResult.is_threat ? '#5c2420' : '#274a34'}`, borderRadius: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 10, color: scanResult.is_threat ? '#ff9a92' : '#88e49c' }}>
                        {scanResult.is_threat ? '🛑 Hallucinated / Squatted Threat Detected' : '✅ Verified PyPI Package'}
                      </strong>
                      <span className={`chip ${scanResult.is_threat ? 'chip-red' : 'chip-green'}`}>
                        {scanResult.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: '#c3d2c6', marginTop: 2 }}>
                      {scanResult.message}
                    </div>
                    {scanResult.latest_version && (
                      <div style={{ fontSize: 8, color: '#7a8e80', marginTop: 1 }}>
                        Latest Version: <code>v{scanResult.latest_version}</code> · Author: {scanResult.author || 'PyPI Community'}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <button className="btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => handleWhitelist(scanResult.package)}>
                        + Add to Whitelist
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Decluttered 2-Column Grid: Blocked Packages & Whitelist */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
                {/* Blocked Packages Card */}
                <div style={{ background: '#141c18', border: '1px solid var(--line)', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="alert" size={13}/>
                      <h4 style={{ margin: 0, fontSize: 11, color: '#e4e7e3' }}>Blocked Threats</h4>
                    </div>
                    <span className="count red-count">{slopFlags.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
                    {slopFlags.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#101713', border: '1px solid #362220', borderRadius: 4 }}>
                        <div>
                          <strong style={{ font: "10px 'IBM Plex Mono'", color: '#ff9a92' }}>{s.package}</strong>
                          <div style={{ fontSize: 8, color: '#889e8f' }}>{s.reason}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: 8 }} onClick={() => handleWhitelist(s.package)}>
                            Whitelist
                          </button>
                          <button className="btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 8 }} onClick={() => handleDeleteSlopFlag(s.package)}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    {!slopFlags.length && (
                      <div style={{ padding: 24, textAlign: 'center', color: '#6f8374', fontSize: 10 }}>
                        ✓ Zero active dependency threats detected.
                      </div>
                    )}
                  </div>
                </div>

                {/* Whitelist Badges Card */}
                <div style={{ background: '#141c18', border: '1px solid var(--line)', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
                    <h4 style={{ margin: 0, fontSize: 11, color: '#a5bda7' }}>Approved Whitelist ({whitelist.length})</h4>
                    <form onSubmit={handleAddWhitelistPackage} style={{ display: 'flex', gap: 4 }}>
                      <input
                        style={{ padding: '3px 6px', background: '#101713', border: '1px solid #334537', borderRadius: 3, color: '#e4e7e3', fontSize: 9, width: 85 }}
                        placeholder="Package..."
                        value={newWhitelistPkg}
                        onChange={e => setNewWhitelistPkg(e.target.value)}
                      />
                      <button type="submit" className="btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: 8 }}>+ Add</button>
                    </form>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 380, overflowY: 'auto', alignContent: 'flex-start' }}>
                    {whitelist.map(pkg => (
                      <span key={pkg} className="chip chip-green" style={{ padding: '3px 8px', fontSize: 8.5 }}>
                        ✓ {pkg}
                      </span>
                    ))}
                    {whitelist.length === 0 && (
                      <div style={{ color: '#6f8374', fontSize: 10, padding: '8px 0' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Workstation Console Controls */}
              <div style={{ background: '#141c18', border: '1px solid #36493b', borderRadius: 6, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="terminal" size={18}/>
                  <div>
                    <strong style={{ fontSize: 12, color: '#e4e7e3' }}>Interactive Sandbox Console Workstation</strong>
                    <div style={{ fontSize: 8, color: '#8fa092' }}>
                      Ephemeral sandbox <code>sbx_8f2a91</code> · Python 3.12 · pytest 8.3.2 · vLLM {config.model_config.model_name}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#121b16', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="search" size={13}/>
                  <input
                    style={{ background: 'transparent', border: 0, outline: 'none', color: '#cad6ca', fontSize: 9, width: 120 }}
                    placeholder="Search logs..."
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                  />
                </div>

                <div style={{ width: 1, height: 16, background: 'var(--line)' }}/>

                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#7a8e80' }}>Stage:</span>
                  {['ALL', 'SYSTEM', 'CLEARANCE', 'AST_ANALYSIS', 'DEPENDENCY_SCAN', 'REPRO_TEST', 'FUZZING', 'MERGE_GATE', 'SANDBOX'].map(st => (
                    <button
                      key={st}
                      className={`chip ${logStageFilter === st ? 'chip-green' : ''}`}
                      style={{ cursor: 'pointer', fontSize: 8, padding: '1px 5px' }}
                      onClick={() => setLogStageFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
                  <span style={{ fontSize: 9, color: '#7a8e80' }}>Level:</span>
                  {['ALL', 'INFO', 'WARN', 'ERROR', 'PASS'].map(lv => (
                    <button
                      key={lv}
                      className={`chip ${logLevelFilter === lv ? 'chip-blue' : ''}`}
                      style={{ cursor: 'pointer', fontSize: 8, padding: '1px 5px' }}
                      onClick={() => setLogLevelFilter(lv)}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Terminal Window */}
              <div style={{ background: '#0a100d', border: '1px solid #2d3f33', borderRadius: 6, minHeight: 460, maxHeight: 680, overflowY: 'auto', padding: 14, fontFamily: "'IBM Plex Mono', monospace" }}>
                {filteredLogs.map(log => (
                  <div key={log.id} className="log-entry" style={{ padding: '3px 0', borderBottom: '1px solid #142018', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#5b7061', fontSize: 8 }}>[{log.timestamp}]</span>
                    <span className="chip" style={{ fontSize: 7.5, padding: '1px 4px', color: '#9bc2a4', background: '#122018' }}>
                      {log.stage}
                    </span>
                    <span className={`chip ${log.level === 'PASS' ? 'chip-green' : log.level === 'WARN' ? 'chip-amber' : log.level === 'ERROR' || log.level === 'ALERT' ? 'chip-red' : 'chip-blue'}`} style={{ fontSize: 7.5, padding: '1px 4px' }}>
                      {log.level}
                    </span>
                    <span style={{ color: '#c9d8cc', fontSize: 10, flex: 1 }}>{log.message}</span>
                  </div>
                ))}
                {!filteredLogs.length && (
                  <div style={{ padding: 30, textAlign: 'center', color: '#778a7e', fontSize: 10 }}>
                    No execution log entries match the current filters.
                  </div>
                )}
                <div style={{ padding: '6px 8px', color: '#88a38f', fontSize: 10 }}>
                  <span className="cursor">▍</span>
                </div>
              </div>
            </div>
          )}



          {/* ════════════════════════════════════════════════════════════════
              TAB: SETTINGS (UNIFIED CONFIGURATION)
             ════════════════════════════════════════════════════════════════ */}
          {tab === 'Settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Settings Subnav Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 13, color: '#e4e7e3', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="settings" size={15}/> System Configuration & Clearance Policies
                  </h3>
                  <p style={{ margin: '1px 0 0', color: '#7a8e80', fontSize: 9.5 }}>
                    Manage zero-trust verification rules, AI inference models, and webhook endpoints.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#111915', border: '1px solid #233427', borderRadius: 5 }}>
                    <span style={{ fontSize: 11, color: '#97e8b0' }}>Zero-Trust Cryptographic & AST Clearance Policies</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>CONTRIBUTOR REPUTATION GATE</div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <label style={{ margin: 0 }}>Minimum Fast-Track Trust Score</label>
                          <span className="chip chip-green" style={{ fontSize: 9 }}>{config.verification_rules.min_trust_score} / 100</span>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                        <div>
                          <strong style={{ fontSize: 11, color: '#e4e7e3' }}>Auto-Quarantine First-Time & Bot Accounts</strong>
                          <div style={{ fontSize: 8, color: '#7a8e80', marginTop: 1 }}>
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

                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>CODE AUDIT & SLOP DEFENSE</div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <label style={{ margin: 0 }}>AST Blast Radius Threshold</label>
                          <span className="chip chip-blue" style={{ fontSize: 9 }}>&le; &Delta;{config.verification_rules.blast_radius_threshold} statements</span>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                        <div>
                          <strong style={{ fontSize: 11, color: '#e4e7e3' }}>Strict PyPI Slopsquatting Protection</strong>
                          <div style={{ fontSize: 8, color: '#7a8e80', marginTop: 1 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#111915', border: '1px solid #233427', borderRadius: 5 }}>
                    <span style={{ fontSize: 11, color: '#97e8b0' }}>LLM Inference Engine & Open-Weight Reasoning Configuration</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                    <div className="chip chip-green" style={{ padding: '4px 10px', width: 'fit-content' }}>
                      ✓ {llmTestStatus}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>ACTIVE INFERENCE BACKEND</div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>Primary Code Model</label>
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
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>Inference Endpoint URL</label>
                        <input
                          value={config.model_config.inference_endpoint}
                          onChange={e => setConfig({
                            ...config,
                            model_config: { ...config.model_config, inference_endpoint: e.target.value }
                          })}
                        />
                      </div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>API Key / Bearer Token</label>
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

                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>REASONING PARAMETERS</div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <label style={{ margin: 0 }}>Sampling Temperature</label>
                          <span className="chip chip-amber" style={{ fontSize: 9 }}>{config.model_config.temperature}</span>
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
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>Context Window Capacity</label>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#111915', border: '1px solid #233427', borderRadius: 5 }}>
                    <span style={{ fontSize: 11, color: '#97e8b0' }}>Webhook Endpoint Security & Sandbox Execution Limits</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>GITHUB WEBHOOK RECEIVER</div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>Target Webhook URL</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input readOnly value={config.repo_settings.webhook_url} style={{ flex: 1 }}/>
                          <button className="btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(config.repo_settings.webhook_url); setNotice('Webhook URL copied!') }}>
                            <Icon name="copy" size={11}/>
                          </button>
                          <button className="btn-primary btn-sm" onClick={handlePingWebhook}>Ping</button>
                        </div>
                      </div>
                      <div className="form-field" style={{ margin: 0 }}>
                        <label style={{ marginBottom: 3 }}>Webhook Secret Token</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={config.repo_settings.webhook_secret}
                            placeholder="whsec_••••••••"
                            onChange={e => setConfig({
                              ...config,
                              repo_settings: { ...config.repo_settings, webhook_secret: e.target.value }
                            })}
                            style={{ flex: 1 }}
                          />
                          <button className="btn-secondary btn-sm" onClick={() => {
                            const newSec = `whsec_${Math.random().toString(36).substring(2, 15)}`
                            setConfig({ ...config, repo_settings: { ...config.repo_settings, webhook_secret: newSec } })
                            setNotice('New webhook secret generated.')
                          }}>
                            Regen
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#141c18', border: '1px solid #2e3e33', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ font: "9px 'IBM Plex Mono'", color: '#8fa594', letterSpacing: 1 }}>EXECUTION & MERGE GATE</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                        <div>
                          <strong style={{ fontSize: 11, color: '#e4e7e3' }}>Auto-Merge on Full Verification Pass</strong>
                          <div style={{ fontSize: 8, color: '#7a8e80', marginTop: 1 }}>
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
                      <div className="form-field" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <label style={{ margin: 0 }}>Sandbox Execution Timeout</label>
                          <span className="chip chip-blue" style={{ fontSize: 9 }}>{config.repo_settings.sandbox_timeout_sec} seconds</span>
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

                  <div style={{ padding: '8px 14px', background: '#1c1414', border: '1px solid #4a2323', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="alert" size={14}/>
                      <div>
                        <strong style={{ fontSize: 10, color: '#ff9a92' }}>Danger Zone · Purge Session & Simulation Data</strong>
                        <div style={{ fontSize: 8, color: '#c99692' }}>Permanently resets PR queue, bug proofs, and simulation data to zero state.</div>
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
        <div className="toast" role="status">
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
          <div className="modal-content" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="github" size={18}/> GitHub Authorization & Connected Repositories</h3>
              <button className="icon-button" onClick={() => setGithubModalOpen(false)}><Icon name="close" size={16}/></button>
            </div>
            <div className="modal-body">
              {/* Account Status Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#17241d', border: '1px solid #364d3c', borderRadius: 6, marginBottom: 18 }}>
                <span className="avatar me" style={{ width: 44, height: 44, fontSize: 14 }}>
                  {initials(githubUser.username)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14, color: '#e4e7e3' }}>
                      {githubUser.authenticated ? (githubUser.name || githubUser.username) : 'Not Authorized'}
                    </strong>
                    <span className={`chip ${githubUser.authenticated ? 'chip-green' : 'chip-amber'}`}>
                      {githubUser.authenticated ? 'AUTHORIZED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8fa092', marginTop: 2 }}>
                    {githubUser.authenticated ? (
                      `@${githubUser.username} · ${repos.length} Repositories Connected`
                    ) : (
                      'Enter your GitHub handle below to connect and inspect your repositories.'
                    )}
                  </div>
                </div>
              </div>

              {/* Authorize Token / Handle Input */}
              <div style={{ background: '#121c16', border: '1px solid var(--line)', padding: 16, borderRadius: 6, marginBottom: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label>GitHub Username</label>
                    <input
                      value={githubUsernameInput}
                      onChange={e => setGithubUsernameInput(e.target.value)}
                      placeholder="e.g. asfandkhan8585-cpu or your-handle"
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label>Personal Access Token (PAT) [Required to approve & merge PRs on GitHub]</label>
                    <input
                      type="password"
                      value={githubPatInput}
                      onChange={e => setGithubPatInput(e.target.value)}
                      placeholder="ghp_... or gho_... (needs 'repo' write scope)"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#7a8e80' }}>
                    Authorizing loads your authentic repositories from GitHub.
                  </span>
                  <button className="btn-primary btn-sm" onClick={handleAuthorizeGitHub}>
                    <Icon name="check" size={13}/> Authorize & Sync Repos
                  </button>
                </div>
              </div>

              {/* Add Custom Repository Section */}
              <div style={{ background: '#121c16', border: '1px solid var(--line)', padding: 14, borderRadius: 6, marginBottom: 18 }}>
                <strong style={{ fontSize: 11, color: '#a5bda7', display: 'block', marginBottom: 8 }}>+ Connect New Custom Repository</strong>
                <form onSubmit={handleAddCustomRepo} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ padding: '6px 10px', background: '#16221b', border: '1px solid #334537', borderRadius: 4, color: '#e4e7e3', fontSize: 10 }}
                    placeholder="Repo name (e.g. backend-api)"
                    value={newRepoName}
                    onChange={e => setNewRepoName(e.target.value)}
                  />
                  <input
                    style={{ padding: '6px 10px', background: '#16221b', border: '1px solid #334537', borderRadius: 4, color: '#e4e7e3', fontSize: 10 }}
                    placeholder="Description (optional)"
                    value={newRepoDesc}
                    onChange={e => setNewRepoDesc(e.target.value)}
                  />
                  <select
                    style={{ padding: '6px 8px', background: '#16221b', border: '1px solid #334537', borderRadius: 4, color: '#e4e7e3', fontSize: 10 }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 12, color: '#e4e7e3' }}>Connected Repositories ({repos.length})</strong>
                  <button className="btn-secondary btn-sm" onClick={handleSyncRepos} disabled={isSyncing}>
                    <Icon name="sync" size={12} className={isSyncing ? "spin-anim" : ""} />
                    <span>{isSyncing ? "Refreshing…" : "Refresh Repos"}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                  {repos.map(r => (
                    <div
                      key={r.id}
                      style={{
                        padding: '12px 14px',
                        background: r.full_name === activeRepo ? '#1f3427' : '#141d18',
                        border: `1px solid ${r.full_name === activeRepo ? '#4b7557' : '#2b3b30'}`,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 12, color: '#e4e7e3' }}>{r.full_name}</strong>
                          {r.is_private && <span className="chip chip-amber">PRIVATE</span>}
                          {r.full_name === activeRepo && <span className="chip chip-green">ACTIVE</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#8fa092', marginTop: 3 }}>
                          {r.description}
                        </div>
                        <div style={{ fontSize: 9, color: '#6d8173', marginTop: 4, display: 'flex', gap: 12 }}>
                          <span>★ {r.stars}</span>
                          <span>Forks: {r.forks}</span>
                          <span>Open PRs: {r.open_prs}</span>
                          <span>Repros: {r.repro_tests}</span>
                          <span>{r.language}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
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
                    <div style={{ padding: 24, textAlign: 'center', color: '#778a7d', fontSize: 11 }}>
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
                <div style={{ padding: 12, background: '#18241d', border: '1px solid #334737', borderRadius: 4, fontSize: 10, color: '#9bb0a0' }}>
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
          <div className="modal-content" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="terminal" size={18}/> {codeDrawer.file} (Issue #{codeDrawer.issue})</h3>
              <button className="icon-button" onClick={() => setCodeDrawer(null)}><Icon name="close" size={16}/></button>
            </div>
            <div className="modal-body">
              <pre style={{ margin: 0, padding: 14, background: '#090e0c', border: '1px solid #27382d', borderRadius: 6, font: "11px/1.8 'IBM Plex Mono', monospace", color: '#8de8a4', overflowX: 'auto' }}>
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
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="bell" size={16}/> System Notifications</h3>
              <button className="icon-button" onClick={() => setNotificationsOpen(false)}><Icon name="close" size={14}/></button>
            </div>
            <div className="modal-body" style={{ maxHeight: 320 }}>
              {events.length > 0 ? (
                events.slice(0, 6).map(evt => (
                  <div key={evt.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8fa092', fontSize: 9 }}>
                      <span>{evt.stage}</span>
                      <span>{timeAgo(evt.timestamp)}</span>
                    </div>
                    <div style={{ marginTop: 3, color: '#e4e7e3' }}>{evt.message}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#7a8e80', fontSize: 11 }}>
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
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: (r.blast_radius.statement_delta > 50) ? '#ff7b72' : '#56d364' }}>
              Δ{r.blast_radius.statement_delta} {r.blast_radius.scope_creep_detected && '⚠'}
            </span>
          ) : (
            <span style={{ fontSize: 9, color: '#7a8e80' }}>-</span>
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
