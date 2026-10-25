import { useState, useEffect, useCallback } from 'react'
import {
  getMetrics, getPRs, getQuarantine, getPipelineEvents,
  getIssueRepros, getSlopsquatFlags, authorizeUser,
  type DashboardMetrics, type PRRecord, type PipelineEvent,
  type IssueRepro, type SlopsquatFlag,
} from './api'

/* ─── Fallback data used when the backend is unreachable ─────────────── */
const fallbackRows: PRRecord[] = [
  { id: 'pr-001', number: 284, repo: 'org/checkout-service', title: 'Fix race condition in payment retry', author: 'sarahchen', author_avatar: '', author_association: 'CONTRIBUTOR', trust_score: 98, status: 'PASSED', tier: 'Verified Contributor', blast_radius: { statement_delta: 4, scope_creep_detected: false }, test_result: { passed: true, exit_code: 0 }, created_at: '2026-10-25T14:28:00Z', pipeline_stage: 'COMPLETE' },
  { id: 'pr-002', number: 283, repo: 'org/checkout-service', title: 'Optimize checkout session validation', author: 'devin-ai[bot]', author_avatar: '', author_association: 'NONE', trust_score: 23, status: 'REJECTED', tier: 'Untrusted / First-Time', blast_radius: { statement_delta: 187, scope_creep_detected: true }, test_result: { passed: false, exit_code: 1 }, created_at: '2026-10-25T14:16:00Z', pipeline_stage: 'BLOCKED' },
  { id: 'pr-003', number: 282, repo: 'org/checkout-service', title: 'Handle null currency in refund flow', author: 'marcusdev', author_avatar: '', author_association: 'CONTRIBUTOR', trust_score: 76, status: 'PASSED', tier: 'Verified Contributor', blast_radius: { statement_delta: 12, scope_creep_detected: false }, test_result: { passed: true, exit_code: 0 }, created_at: '2026-10-25T14:10:00Z', pipeline_stage: 'COMPLETE' },
  { id: 'pr-004', number: 281, repo: 'org/checkout-service', title: 'Add idempotency key verification', author: 'alexrivera', author_avatar: '', author_association: 'MEMBER', trust_score: 100, status: 'PASSED', tier: 'VIP Fast-Track', blast_radius: { statement_delta: 2, scope_creep_detected: false }, test_result: { passed: true, exit_code: 0 }, created_at: '2026-10-25T13:56:00Z', pipeline_stage: 'COMPLETE' },
  { id: 'pr-005', number: 280, repo: 'org/checkout-service', title: 'Update dependency resolution', author: 'codepilot[bot]', author_avatar: '', author_association: 'NONE', trust_score: 12, status: 'REJECTED', tier: 'Untrusted / First-Time', blast_radius: { statement_delta: 245, scope_creep_detected: true }, test_result: { passed: false, exit_code: 1 }, created_at: '2026-10-25T13:42:00Z', pipeline_stage: 'BLOCKED' },
]

const fallbackQueue: PRRecord[] = [
  { id: 'pr-q1', number: 287, repo: 'org/checkout-service', title: 'Fix XSS vulnerability in search input', author: 'jason-builds', author_avatar: '', author_association: 'NONE', trust_score: 0, status: 'QUARANTINED', tier: 'Untrusted / First-Time', blast_radius: { statement_delta: 8, scope_creep_detected: false }, test_result: null, created_at: '2026-10-25T14:30:00Z', pipeline_stage: 'QUARANTINE' },
  { id: 'pr-q2', number: 286, repo: 'org/checkout-service', title: 'Add automated refund processing', author: 'auto-fix-agent', author_avatar: '', author_association: 'NONE', trust_score: 0, status: 'QUARANTINED', tier: 'Untrusted / First-Time', blast_radius: null, test_result: null, created_at: '2026-10-25T14:18:00Z', pipeline_stage: 'QUARANTINE' },
  { id: 'pr-q3', number: 285, repo: 'org/checkout-service', title: 'Dark mode toggle component', author: 'priyasharma', author_avatar: '', author_association: 'NONE', trust_score: 0, status: 'QUARANTINED', tier: 'Untrusted / First-Time', blast_radius: { statement_delta: 34, scope_creep_detected: false }, test_result: null, created_at: '2026-10-25T14:04:00Z', pipeline_stage: 'QUARANTINE' },
]

const fallbackMetrics: DashboardMetrics = {
  total_prs_reviewed: 8, prs_passed: 3, prs_rejected: 2, prs_quarantined: 3,
  issues_reproduced: 3, active_red_tests: 2, slopsquat_packages_blocked: 2, pipeline_events_24h: 8,
}

const fallbackEvents: PipelineEvent[] = [
  { id: 'evt-1', pr_id: 'pr-004', stage: 'CLEARANCE', status: 'passed', timestamp: '2026-10-25T14:30:01Z', message: 'VIP Fast-Track: alexrivera cleared instantly.' },
  { id: 'evt-2', pr_id: 'pr-004', stage: 'AST_ANALYSIS', status: 'passed', timestamp: '2026-10-25T14:30:02Z', message: 'Blast radius minimal: Δ2 statements, no scope creep.' },
  { id: 'evt-3', pr_id: 'pr-004', stage: 'REPRO_TEST', status: 'passed', timestamp: '2026-10-25T14:30:04Z', message: 'RED→GREEN flip confirmed. Bug reproduction test passed.' },
  { id: 'evt-4', pr_id: 'pr-004', stage: 'FUZZING', status: 'passed', timestamp: '2026-10-25T14:30:06Z', message: 'Adversarial mutations: 0/50 edge cases broke the fix.' },
  { id: 'evt-5', pr_id: 'pr-004', stage: 'MERGE_GATE', status: 'passed', timestamp: '2026-10-25T14:30:07Z', message: '✅ All gates passed. PR #281 auto-approved for merge.' },
  { id: 'evt-6', pr_id: 'pr-002', stage: 'CLEARANCE', status: 'failed', timestamp: '2026-10-25T09:34:01Z', message: '⚠ devin-ai[bot] flagged as untrusted. Quarantine triggered.' },
  { id: 'evt-7', pr_id: 'pr-002', stage: 'AST_ANALYSIS', status: 'failed', timestamp: '2026-10-25T09:34:03Z', message: '🚨 Scope creep: +187 statements, 5 new functions injected.' },
  { id: 'evt-8', pr_id: 'pr-002', stage: 'DEPENDENCY_SCAN', status: 'failed', timestamp: '2026-10-25T09:34:05Z', message: '🛑 Slopsquatting detected: "reqeusts" is a hallucinated PyPI package.' },
]

const fallbackRepros: IssueRepro[] = [
  { issue_number: 279, repo: 'org/checkout-service', title: 'Concurrent payment retry causes double charge', repro_status: 'RED', test_file: 'test_repro_279.py', created_at: '2026-10-25T07:00:00Z' },
  { issue_number: 277, repo: 'org/checkout-service', title: 'Currency rounding error on totals > $999', repro_status: 'GREEN', test_file: 'test_repro_277.py', created_at: '2026-10-25T06:30:00Z' },
  { issue_number: 275, repo: 'org/checkout-service', title: 'XSS via search input field', repro_status: 'RED', test_file: 'test_repro_275.py', created_at: '2026-10-25T08:45:00Z' },
]

const fallbackSlopsquat: SlopsquatFlag[] = [
  { package: 'reqeusts', reason: 'Hallucinated Package (Does not exist on PyPI!)', pr_id: 'pr-002', detected_at: '2026-10-25T09:34:05Z' },
  { package: 'colorsys2', reason: 'Hallucinated Package (Does not exist on PyPI!)', pr_id: 'pr-005', detected_at: '2026-10-25T13:15:03Z' },
]

/* ─── SVG Icon Set ───────────────────────────────────────────────────── */
function Icon({ name, size = 18 }: { name: string; size?: number }) {
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
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.shield}</svg>
}

/* ─── Main Application ───────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState('Overview')
  const [terminal, setTerminal] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filter, setFilter] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [reverse, setReverse] = useState(false)

  // ── Live backend state ──
  const [backendOnline, setBackendOnline] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics>(fallbackMetrics)
  const [prs, setPrs] = useState<PRRecord[]>(fallbackRows)
  const [queue, setQueue] = useState<PRRecord[]>(fallbackQueue)
  const [events, setEvents] = useState<PipelineEvent[]>(fallbackEvents)
  const [repros, setRepros] = useState<IssueRepro[]>(fallbackRepros)
  const [slopFlags, setSlopFlags] = useState<SlopsquatFlag[]>(fallbackSlopsquat)
  const [authorizing, setAuthorizing] = useState<string | null>(null)

  // Fetch all dashboard data
  const refreshData = useCallback(async () => {
    try {
      const [m, p, q, e, r, s] = await Promise.all([
        getMetrics(), getPRs(), getQuarantine(),
        getPipelineEvents(), getIssueRepros(), getSlopsquatFlags(),
      ])
      setMetrics(m); setPrs(p); setQueue(q)
      setEvents(e); setRepros(r); setSlopFlags(s)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }
  }, [])

  useEffect(() => {
    refreshData()
    const id = setInterval(refreshData, 5000)
    return () => clearInterval(id)
  }, [refreshData])

  // Dismiss notices after 4 seconds
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(id)
  }, [notice])

  // Authorize handler
  const handleAuthorize = async (username: string) => {
    setAuthorizing(username)
    try {
      if (backendOnline) {
        await authorizeUser(username)
        await refreshData()
        setNotice(`✅ ${username}: execution authorized. Sandbox run passed.`)
      } else {
        setQueue(prev => prev.filter(u => u.author !== username))
        setNotice(`${username}: execution authorized for this session`)
      }
    } catch {
      setNotice(`⚠ Failed to authorize ${username}. Check backend connection.`)
    }
    setAuthorizing(null)
  }

  const handleReject = (username: string) => {
    setQueue(prev => prev.filter(u => u.author !== username))
    setNotice(`${username}: contribution rejected`)
  }

  // ── Filter + search PR table ──
  const filteredPrs = prs.filter(r => {
    const statusMatch = filter === 'All statuses'
      || (filter === 'Passed' && r.status === 'PASSED')
      || (filter === 'Rejected' && r.status === 'REJECTED')
      || (filter === 'Quarantined' && r.status === 'QUARANTINED')
    const queryMatch = `${r.title} ${r.author} ${r.number}`.toLowerCase().includes(query.toLowerCase())
    return statusMatch && queryMatch
  })

  const sortedPrs = reverse ? [...filteredPrs].reverse() : filteredPrs

  const logs = '[14:32:08] sandbox initialized · isolated / ephemeral\n[14:32:09] pytest tests/repro/test_issue_279.py -v\n[14:32:09] collected 24 items\n[14:32:10] test_concurrent_payment_retry PASSED\n[14:32:11] test_idempotency_collision PASSED\n[14:32:12] adversarial mutation #041: bypass currency validation\n[14:32:12] mutation killed · assertion preserved\n[14:32:13] fuzzing 128 edge cases… running'

  const mapStatus = (s: string) => s === 'PASSED' ? 'Passed' : s === 'REJECTED' ? 'Rejected' : s === 'QUARANTINED' ? 'Quarantined' : 'Running'
  const badgeClass = (s: string) => s === 'PASSED' ? 'passed' : s === 'REJECTED' ? 'rejected' : s === 'QUARANTINED' ? 'review' : 'review'
  const scoreClass = (v: number) => v >= 80 ? 'good' : v < 30 ? 'bad' : 'mid'
  const initials = (name: string) => name.slice(0, 2).toUpperCase()
  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff} min ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return <div className="app">
    {/* ── Top bar ── */}
    <header>
      <a className="brand" href="#">
        <span className="brand-icon"><Icon name="shield" size={23}/></span>
        GhostRepro<span className="beta">BETA</span>
      </a>
      <span className="header-divider"/>
      <div className="repo">
        <Icon name="branch" size={16}/>
        <select aria-label="Repository">
          <option>org / checkout-service</option>
          <option>org / payments-api</option>
        </select>
        <span className="private">PRIVATE</span>
      </div>
      <div className="header-right">
        <span className="system">
          <i style={{ background: backendOnline ? '#3fb950' : '#e3b341' }}/>
          {backendOnline ? 'Backend connected · All systems operational' : 'Offline mode · Using demo data'}
        </span>
        <span className="model"><span>◈</span> Qwen3-Coder <small>30B</small></span>
        <button className="icon-button" aria-label="Notifications" onClick={() => setNotice('You\'re all caught up. No new notifications.')}><Icon name="bell"/></button>
        <button className="avatar me" onClick={() => setNotice('Signed in as Alex Morgan · Repository maintainer')}>AM</button>
      </div>
    </header>

    <div className="workspace">
      {/* ── Sidebar ── */}
      <aside>
        <div className="side-label">WORKSPACE</div>
        {([['Overview','grid'],['Pull requests','branch'],['Quarantine','shield'],['Bug reproductions','bug'],['Execution logs','terminal']] as const).map(([label, icon]) =>
          <button key={label} className={`nav-item ${tab === label ? 'selected' : ''}`} onClick={() => {setTab(label); if(label === 'Execution logs')setTerminal(true)}}>
            <Icon name={icon}/><span>{label}</span>
            {label === 'Quarantine' && <b>{queue.length}</b>}
            {label === 'Pull requests' && <small>{prs.length}</small>}
            {label === 'Bug reproductions' && <small>{repros.length}</small>}
          </button>
        )}
        <div className="side-separator"/>
        <div className="side-label">THREAT INTEL</div>
        <button className={`nav-item ${tab === 'Slopsquatting' ? 'selected' : ''}`} onClick={() => setTab('Slopsquatting')}>
          <Icon name="package"/><span>Slopsquatting</span>
          {slopFlags.length > 0 && <b>{slopFlags.length}</b>}
        </button>
        <button className={`nav-item ${tab === 'AST analysis' ? 'selected' : ''}`} onClick={() => setTab('AST analysis')}>
          <Icon name="zap"/><span>AST analysis</span>
        </button>
        <div className="side-separator"/>
        <div className="side-label">CONFIGURATION</div>
        <button className="nav-item" onClick={() => setNotice('Policy: strict verification · 80 minimum trust score · sandbox isolation enabled')}><Icon name="shield"/><span>Verification rules</span></button>
        <button className="nav-item" onClick={() => setNotice('Qwen3-Coder 30B · local inference · 32k context window')}><Icon name="activity"/><span>Models & agents</span></button>
        <button className="nav-item" onClick={() => setNotice('Repository connected · Webhooks active · Auto-merge disabled')}><Icon name="settings"/><span>Settings</span></button>
        <div className="sidebar-bottom">
          <div className="guard-symbol"><Icon name="shield" size={22}/></div>
          <strong>Your merge gate. Reinforced.</strong>
          <p>Every contribution verified.<br/>Nothing taken on trust.</p>
          <div className="version"><span className="dot"/> GhostRepro v0.8.2 <span>↗</span></div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main>
        <div className="breadcrumbs">Workspace <span>/</span> checkout-service <span>/</span> <b>{tab}</b></div>
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span/> TRUST NOTHING. VERIFY EVERYTHING.</div>
            <h1>{tab === 'Overview' ? 'Mission control' : tab}</h1>
            <p>Your repository's first line of defense. Every issue reproduced. Every PR challenged.</p>
          </div>
          <button className="button" onClick={() => setTerminal(true)}><Icon name="terminal" size={16}/> Execution logs <span>↗</span></button>
        </div>

        <div className="overview-meta">
          <span><i className="dot" style={{ background: backendOnline ? '#3fb950' : '#e3b341' }}/> {backendOnline ? 'LIVE' : 'DEMO'} REPOSITORY OVERVIEW</span>
          <span><Icon name="clock" size={13}/> Last synced just now <span className="period">Last 30 days <span>⌄</span></span></span>
        </div>

        {/* ── Metric Cards ── */}
        {(tab === 'Overview' || tab === 'Pull requests') && <section className="metrics">
          {[
            { label: 'VERIFIED ISSUES', value: String(metrics.issues_reproduced).replace(/\B(?=(\d{3})+(?!\d))/g, ','), delta: `${metrics.active_red_tests} active RED`, note: 'issues successfully reproduced', icon: 'check', spark: '0,32 12,30 20,34 30,20 40,23 50,15 60,18 70,8 80,12 94,0', idx: 0 },
            { label: 'BLOCKED AI SLOP PRs', value: String(metrics.prs_rejected), delta: `+${metrics.slopsquat_packages_blocked} slopsquat`, note: 'low-trust contributions stopped', icon: 'shield', spark: '0,34 12,32 20,20 30,27 40,17 50,22 60,6 70,14 80,8 94,0', idx: 1 },
            { label: 'QUARANTINED USERS', value: String(metrics.prs_quarantined).padStart(2, '0'), delta: 'Needs review', note: 'contributors awaiting authorization', icon: 'shield', spark: '', idx: 2 },
            { label: 'ACTIVE MODEL', value: 'Qwen3-Coder', delta: 'Open-weight', note: '30B parameters · local inference', icon: 'activity', spark: '', idx: 3 },
          ].map((m) =>
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
          )}
        </section>}

        {/* ── Active Pipeline ── */}
        {(tab === 'Overview') && <section className="panel pipeline">
          <div className="panel-heading">
            <div className="section-title"><Icon name="branch"/><h2>Active pipeline</h2><span className="pipeline-id">Issue #279 <span>→</span> PR #282</span></div>
            <div className="processing"><i/> Verification in progress</div>
          </div>
          <div className="steps">
            {[
              { title: 'Issue opened', sub: 'Reproduction target identified', state: 'Completed' },
              { title: 'AST parsing', sub: 'Codebase context extracted', state: 'Completed' },
              { title: 'Reproduction test', sub: '24 assertions generated', state: 'Completed' },
              { title: 'PR verification', sub: 'Adversarial fuzzing · 84 / 128', state: 'Processing' },
              { title: 'Merge gate', sub: 'Awaiting verification results', state: 'Pending' },
            ].map((s, i) =>
              <div className={`step ${i < 3 ? 'complete' : i === 3 ? 'active' : 'pending'}`} key={s.title}>
                <div className="step-track">
                  <span className="step-circle">{i < 3 ? <Icon name="check" size={15}/> : i + 1}</span>
                  <div className="step-line"/>
                </div>
                <strong>{s.title}</strong>
                <p>{s.sub}</p>
                <span className="step-state">{i === 3 && <i/>}{s.state}</span>
              </div>
            )}
          </div>
          <div className="pipeline-footer">
            <span><span className="dot"/> Sandbox <code>sbx_8f2a91</code><span className="footer-sep">|</span> Isolated environment <span className="footer-sep">|</span> Started 2m 14s ago</span>
            <button onClick={() => setTerminal(true)}>View live execution <span>↗</span></button>
          </div>
        </section>}

        {/* ── Pipeline Activity Feed (visible in Overview) ── */}
        {(tab === 'Overview') && events.length > 0 && <section className="panel" style={{ marginTop: 20, marginBottom: 20 }}>
          <div className="panel-heading">
            <div className="section-title"><Icon name="activity"/><h2>Pipeline activity feed</h2><span className="count">{events.length}</span></div>
            <span className="tiny-label">LAST 24H</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {events.map(evt =>
              <div key={evt.id} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start', fontSize: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: evt.status === 'passed' ? 'var(--green)' : 'var(--red)', boxShadow: evt.status === 'passed' ? '0 0 6px #3fb95060' : '0 0 6px #f8514960' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: 2 }}>{evt.stage}</div>
                  <div style={{ color: '#c9d1d9', lineHeight: 1.5 }}>{evt.message}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{timeAgo(evt.timestamp)}</div>
                </div>
              </div>
            )}
          </div>
        </section>}

        {/* ── PR Scorecards + Quarantine ── */}
        {(tab === 'Overview' || tab === 'Pull requests' || tab === 'Quarantine') && <div className="data-grid">
          <section className="panel scorecards">
            <div className="panel-heading">
              <div className="section-title"><h2>Recent pull request scorecards</h2><span className="count">{prs.length}</span></div>
              <button className="text-button" onClick={() => {setFilter('All statuses'); setQuery(''); setNotice('Showing all recent pull requests')}}>View all <span>↗</span></button>
            </div>
            <div className="table-toolbar">
              <div className="search"><Icon name="search" size={15}/><input placeholder="Search pull requests…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
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
                  {sortedPrs.map(r =>
                    <Row key={r.id} row={r} expanded={expanded === r.number} toggle={() => setExpanded(expanded === r.number ? null : r.number)} timeAgo={timeAgo} mapStatus={mapStatus} badgeClass={badgeClass} scoreClass={scoreClass} initials={initials}/>
                  )}
                </tbody>
              </table>
              {!sortedPrs.length && <div className="empty">No matching pull requests.</div>}
            </div>
            <div className="table-bottom">
              Showing {sortedPrs.length} of {prs.length} pull requests
              <span><i className="dot"/> Continuously verified</span>
            </div>
          </section>

          <section className="panel quarantine">
            <div className="panel-heading">
              <div className="section-title"><Icon name="shield" size={17}/><h2>Quarantine queue</h2><span className="count red-count">{queue.length}</span></div>
              <span className="tiny-label">ACCESS CONTROL</span>
            </div>
            <div className="queue-notice"><Icon name="shield" size={15}/><span>Execution is paused until you authorize access.</span></div>
            {queue.map((pr, i) =>
              <div className="queue-item" key={pr.id}>
                <div className="queue-person">
                  <span className={`avatar avatar-${i}`}>{initials(pr.author)}</span>
                  <div>
                    <strong>{pr.author}</strong>
                    <span>PR #{pr.number} <span>·</span> {timeAgo(pr.created_at)}</span>
                  </div>
                  <span className="external">↗</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', margin: '6px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pr.title}
                </div>
                <div className="risk">
                  <span>!</span>
                  {pr.author_association === 'NONE' ? 'First-time contributor · untrusted execution' : 'Unverified bot · elevated permissions'}
                </div>
                <div className="queue-actions">
                  <button disabled={authorizing === pr.author} onClick={() => handleAuthorize(pr.author)}>
                    <Icon name="check" size={13}/> {authorizing === pr.author ? 'Running…' : 'Authorize execution'}
                  </button>
                  <button onClick={() => handleReject(pr.author)}>Review & reject</button>
                </div>
              </div>
            )}
            {!queue.length && <div className="empty">All clear. No contributors awaiting review.</div>}
            <div className="quarantine-footer"><Icon name="shield" size={13}/> Zero-trust execution. Human-controlled access.</div>
          </section>
        </div>}

        {/* ── Bug Reproductions Panel ── */}
        {(tab === 'Overview' || tab === 'Bug reproductions') && <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div className="section-title"><Icon name="bug"/><h2>Issue → Reproduction tests (BRT)</h2><span className="count">{repros.length}</span></div>
            <span className="tiny-label">AUTONOMOUS TRAPS</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
            {repros.map(r =>
              <div key={r.issue_number} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 5, background: '#11161d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, fontWeight: 700, color: '#79c0ff' }}>#{r.issue_number}</span>
                  <span className={`badge ${r.repro_status === 'RED' ? 'rejected' : 'passed'}`}><i/>{r.repro_status === 'RED' ? '🔴 RED' : '🟢 GREEN'}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#e6edf3', marginBottom: 8, lineHeight: 1.4 }}>{r.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: '#8b949e', padding: '3px 6px', background: '#161b22', borderRadius: 4 }}>{r.test_file}</span>
                  <span style={{ fontSize: 8, color: '#8b949e' }}>{timeAgo(r.created_at)}</span>
                </div>
              </div>
            )}
          </div>
        </section>}

        {/* ── Slopsquatting Detection Panel ── */}
        {(tab === 'Overview' || tab === 'Slopsquatting') && slopFlags.length > 0 && <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div className="section-title"><Icon name="alert"/><h2>Slopsquatting — Hallucinated packages</h2><span className="count red-count">{slopFlags.length}</span></div>
            <span className="tiny-label">PYPI DEFENSE</span>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slopFlags.map((s, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: '#3b1e2320', border: '1px solid #6c303630', borderRadius: 5 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🛑</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 700, color: '#ff938a' }}>{s.package}</div>
                  <div style={{ fontSize: 10, color: '#b1bac4', marginTop: 3 }}>{s.reason}</div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, color: '#8b949e', textAlign: 'right' }}>
                  <div>{s.pr_id}</div>
                  <div>{timeAgo(s.detected_at)}</div>
                </div>
              </div>
            )}
          </div>
        </section>}

        {/* ── AST Analysis Panel ── */}
        {(tab === 'AST analysis') && <section className="panel" style={{ marginTop: 0 }}>
          <div className="panel-heading">
            <div className="section-title"><Icon name="zap"/><h2>AST blast-radius analysis</h2></div>
            <span className="tiny-label">CODE DIFF METRICS</span>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {prs.filter(pr => pr.blast_radius).map(pr =>
                <div key={pr.id} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 5, background: '#11161d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#79c0ff' }}>PR #{pr.number}</span>
                    <span className={`badge ${pr.blast_radius?.scope_creep_detected ? 'rejected' : 'passed'}`}>
                      <i/>{pr.blast_radius?.scope_creep_detected ? 'SCOPE CREEP' : 'CLEAN'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#e6edf3', marginBottom: 10, lineHeight: 1.4 }}>{pr.title}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono'", color: (pr.blast_radius?.statement_delta || 0) > 50 ? '#ff938a' : '#56d364' }}>
                        Δ{pr.blast_radius?.statement_delta}
                      </div>
                      <div style={{ fontSize: 8, color: '#8b949e', marginTop: 2 }}>statement delta</div>
                    </div>
                    <div style={{ width: 1, background: 'var(--line)' }}/>
                    <div>
                      <div style={{ fontSize: 10, color: '#b1bac4', marginBottom: 4 }}>
                        <strong>Author:</strong> {pr.author}
                      </div>
                      <div style={{ fontSize: 10, color: '#b1bac4' }}>
                        <strong>Tier:</strong> {pr.tier}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>}

        <footer className="main-footer">
          <span><Icon name="shield" size={13}/> Built for maintainers. Not for blind trust.</span>
          <span><i className="dot"/> All execution sandboxed <span className="footer-sep">/</span> {backendOnline ? 'Backend: localhost:8000' : 'Demo mode'}</span>
        </footer>
      </main>
    </div>

    {/* ── Bottom terminal bar ── */}
    <button className="terminal-bar" onClick={() => setTerminal(!terminal)}>
      <span><Icon name="terminal" size={15}/><b>Sandbox console</b><span className="dot"/><span>sbx_8f2a91</span><span className="console-last">Running adversarial mutation 84 of 128…</span></span>
      <span>Live <span className="keyboard">⌃ `</span> <span>⌃</span></span>
    </button>

    {/* ── Toast notification ── */}
    {notice && <div className="toast" role="status"><Icon name="check" size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="close" size={14}/></button></div>}

    {/* ── Terminal drawer ── */}
    {terminal && <div className="drawer">
      <div className="drawer-header">
        <span><Icon name="terminal"/> Sandbox execution <span className="processing"><i/> Live</span></span>
        <div>
          <button onClick={() => {navigator.clipboard?.writeText(logs); setCopied(true)}}><Icon name="copy" size={15}/>{copied ? 'Copied' : 'Copy logs'}</button>
          <button aria-label="Close execution logs" onClick={() => setTerminal(false)}><Icon name="close"/></button>
        </div>
      </div>
      <div className="terminal-meta">sbx_8f2a91 <span>/</span> PR #282 <span>/</span> Python 3.12 · pytest 8.3.2</div>
      <pre>{logs}<span className="cursor">▍</span></pre>
    </div>}
  </div>
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
  return <>
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
        {r.blast_radius && <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: (r.blast_radius.statement_delta > 50) ? '#ff7b72' : '#56d364' }}>
          Δ{r.blast_radius.statement_delta} {r.blast_radius.scope_creep_detected && '⚠'}
        </span>}
      </td>
      <td>
        <button className={`expand ${expanded ? 'rotated' : ''}`} aria-label={`Expand PR ${r.number}`}><Icon name="arrow" size={15}/></button>
      </td>
    </tr>
    {expanded && <tr className="detail-row">
      <td colSpan={5}>
        <Icon name="shield" size={14}/>
        <span>
          {r.test_result ? (r.test_result.passed ? '✅ All tests passed.' : '❌ Tests failed.') : '⏳ Awaiting execution.'}
          {' '}Tier: {r.tier} · Blast radius: Δ{r.blast_radius?.statement_delta ?? '?'} statements
          {r.blast_radius?.scope_creep_detected && ' · ⚠ Scope creep detected'}
        </span>
      </td>
    </tr>}
  </>
}
