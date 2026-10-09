import { useState, type FormEvent } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, Bot, Building2, ChevronDown, Crown, Gift, LayoutDashboard, LogOut, Menu, RefreshCw, Search, Shield, ShieldCheck, Swords, TrendingUp, Trophy, UsersRound, X, Zap } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './workspace-context';
import { OperationsProvider } from './operations-context';
import { ApplicantsPage } from './pages/applicants';
import { BaseBuilderPage } from './pages/base-builder';
import { CWLRoomPage } from './pages/cwl-room';
import { FamilyHubPage } from './pages/family-hub';
import { KotHEventsPage } from './pages/koth-events';
import { RecruitmentPage } from './pages/recruitment';
import type { AppRole } from './types';
import { AlertPage, ClanPage, DashboardPage, FinderPage, HistoryPage, IntegrationPage, MemberDetailPage, MembersPage, RankedPage, ReadinessPage, RewardsPage, SettingsPage, WarsPage } from './pages';
import { Avatar, Badge, Button, IconButton, ProgressBar } from './components/ui';

const roleWeight: Record<AppRole, number> = { member: 1, elder: 2, co_leader: 3, leader: 4 };
const roleLabels: Record<AppRole, string> = { leader: 'Leader', co_leader: 'Co-Leader', elder: 'Elder', member: 'Member' };

const navigation = [
  { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, group: 'Command', minimum: 'member' as AppRole },
  { label: 'Family hub', to: '/app/family', icon: UsersRound, group: 'Clan', minimum: 'member' as AppRole },
  { label: 'Roster', to: '/app/members', icon: UsersRound, group: 'Clan', minimum: 'elder' as AppRole },
  { label: 'Clans', to: '/app/clans', icon: Building2, group: 'Clan', minimum: 'leader' as AppRole },
  { label: 'Applicant inspector', to: '/app/applicants', icon: Search, group: 'Clan', minimum: 'co_leader' as AppRole },
  { label: 'War room', to: '/app/wars', icon: Swords, group: 'Battle', minimum: 'elder' as AppRole },
  { label: 'CWL War Room', to: '/app/cwl', icon: ShieldCheck, group: 'Battle', minimum: 'co_leader' as AppRole },
  { label: 'War readiness', to: '/app/readiness', icon: ShieldCheck, group: 'Battle', minimum: 'elder' as AppRole },
  { label: 'King of the Hill', to: '/app/events', icon: Trophy, group: 'Battle', minimum: 'member' as AppRole },
  { label: 'Progression', to: '/app/progression', icon: TrendingUp, group: 'Growth', minimum: 'member' as AppRole },
  { label: 'Ranked', to: '/app/ranked', icon: Trophy, group: 'Growth', minimum: 'member' as AppRole },
  { label: 'Rewards', to: '/app/rewards', icon: Gift, group: 'Growth', minimum: 'member' as AppRole },
  { label: 'Base builder', to: '/app/bases', icon: Building2, group: 'Growth', minimum: 'member' as AppRole },
  { label: 'Alerts', to: '/app/alerts', icon: Bell, group: 'Tools', minimum: 'elder' as AppRole },
  { label: 'Player finder', to: '/app/finder', icon: Search, group: 'Tools', minimum: 'member' as AppRole },
  { label: 'Recruitment search', to: '/recruitment', icon: UsersRound, group: 'Tools', minimum: 'member' as AppRole },
  { label: 'Discord bot', to: '/app/discord', icon: Bot, group: 'Tools', minimum: 'leader' as AppRole },
  { label: 'Settings', to: '/app/settings', icon: Activity, group: 'Tools', minimum: 'leader' as AppRole },
];

function LoadingScreen() {
  return <main className="boot-screen"><div className="boot-mark"><Shield size={30} /></div><span className="eyebrow">Clan Command</span><strong>Loading your village…</strong><div className="boot-progress"><i /></div></main>;
}

function SignInPage() {
  const { user, signIn, signInDemo, demoMode } = useWorkspace();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/app/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await signIn(email, password); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  }

  async function tryDemo(role: AppRole) {
    setBusy(true); setError('');
    try { await signInDemo(role); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Demo access could not be opened.'); }
    finally { setBusy(false); }
  }

  return <main className="sign-in-page">
    <div className="sign-in-orbit sign-in-orbit--one" /><div className="sign-in-orbit sign-in-orbit--two" />
    <section className="sign-in-card">
      <div className="sign-in-card__brand"><span className="crest-emblem"><Shield size={25} fill="currentColor" /></span><span>CLAN <b>COMMAND</b></span></div>
      <div className="sign-in-card__copy"><Badge tone="gold" dot>CLAN OPERATIONS HUB</Badge><h1>Ready for<br />the next war.</h1><p>One command center for your roster, war room, progression and rewards.</p></div>
      <form className="sign-in-form" onSubmit={submit}>
        <label className="form-field"><span>Email address</span><input type="email" autoComplete="username" placeholder="leader@yourclan.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="form-field"><span>Password</span><input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <Button type="submit" className="sign-in-submit" disabled={busy} leading={<ShieldCheck size={17} />}>{busy ? 'Checking access…' : 'Enter clan command'}</Button>
      </form>
      {demoMode ? <div className="demo-access">
        <div className="demo-access__heading"><span>Sandbox access</span><small>Explore a role with fictional demo data</small></div>
        <div className="demo-role-grid">
          {(['leader','co_leader','elder','member'] as AppRole[]).map((role) => <button key={role} type="button" disabled={busy} onClick={() => void tryDemo(role)}><span className={`role-seal role-seal--${role}`}><ShieldCheck size={15} /></span><span>{roleLabels[role]}<small>{role === 'leader' ? 'Full command' : role === 'co_leader' ? 'War & roster' : role === 'elder' ? 'Readiness tools' : 'Player view'}</small></span><b>↗</b></button>)}
        </div>
      </div> : <p className="sign-in-help">Need access? Ask a clan Leader to provision your account.</p>}
      <a className="sign-in-public-link" href="/recruitment">Explore public player &amp; clan search <Search size={14}/></a>
      <footer><span><i /> Secure session</span><span>Clash of Clans clan management</span></footer>
    </section>
    <aside className="sign-in-side-note"><span className="eyebrow">Your clan, in sync</span><h2>Built for every<br />role in the clan.</h2><div className="sign-in-side-note__roles"><span><Crown size={15} /> Leadership</span><span><Swords size={15} /> Battle crew</span><span><Zap size={15} /> Every member</span></div></aside>
  </main>;
}

function ProtectedRoute({ minimum = 'member', children }: { minimum?: AppRole; children: React.ReactNode }) {
  const { user } = useWorkspace();
  if (!user || roleWeight[user.role] < roleWeight[minimum]) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function WorkspaceLayout() {
  const { user, data, signOut, refresh, loading } = useWorkspace();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  if (!user || !data) return <LoadingScreen />;
  const active = navigation.find((item) => location.pathname === item.to || (item.to !== '/app/dashboard' && location.pathname.startsWith(item.to)));
  const canSee = (minimum: AppRole) => roleWeight[user.role] >= roleWeight[minimum];
  const openAlerts = data.alerts.filter((alert) => alert.status !== 'resolved').length;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate(`/app/finder?q=${encodeURIComponent(value)}`);
    setMobileMenu(false);
  }

  return <div className="workspace-shell">
    {mobileMenu ? <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} /> : null}
    <aside className={`sidebar ${mobileMenu ? 'sidebar--open' : ''}`}>
      <a className="brand-lockup" href="/app/dashboard" onClick={() => setMobileMenu(false)}>
        <span className="brand-lockup__crest"><Shield size={26} fill="currentColor" /></span>
        <span><strong>CLAN COMMAND</strong><small>OPERATIONS HUB <i /></small></span>
      </a>
      <div className="family-selector"><span className="family-selector__badge"><Crown size={16} /></span><span><small>ACTIVE FAMILY</small><strong>Misclicked Family</strong></span><ChevronDown size={15} /></div>
      <nav className="side-nav" aria-label="Main navigation">
        {['Command','Clan','Battle','Growth','Tools'].map((group) => {
          const links = navigation.filter((item) => item.group === group && canSee(item.minimum));
          if (!links.length) return null;
          return <div className="side-nav__group" key={group}><span className="side-nav__label">{group}</span>{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileMenu(false)} className={({ isActive }) => `side-nav__link ${isActive ? 'side-nav__link--active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Alerts' && openAlerts ? <b className="nav-count">{openAlerts}</b> : null}{label === 'War room' ? <i className="nav-live-dot" title="Active war" /> : null}</NavLink>)}</div>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="season-card"><div className="season-card__top"><span className="eyebrow">CURRENT SEASON</span><Badge tone="gold">OCT ’26</Badge></div><strong>Rise of the<br />Iron Crown</strong><div className="season-card__progress"><span>Season progress</span><b>68%</b></div><ProgressBar value={68} tone="gold" /><small>12 days remaining</small></div>
        <div className="sidebar-online"><i /> All systems operational <span>•</span> v0.1</div>
      </div>
    </aside>

    <div className="workspace-main">
      <header className="topbar">
        <div className="topbar__title"><IconButton className="mobile-menu-toggle" label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={20} /></IconButton><span className="topbar__breadcrumb">CLAN COMMAND <b>/</b> {active?.label || 'OVERVIEW'}</span><h1>{active?.label || 'Dashboard'}</h1></div>
        <form className="global-search" onSubmit={submitSearch}><Search size={16} /><input aria-label="Search players by name or tag" placeholder="Search player, tag or clan…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></form>
        <div className="topbar__actions"><Badge tone="green" dot className="connected-badge">LIVE SYNC</Badge><IconButton label="Refresh workspace" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16} className={loading ? 'spin' : ''} /></IconButton><div className="profile-menu"><Avatar name={user.displayName} size="sm" /><span><strong>{user.displayName}</strong><small>{roleLabels[user.role]}</small></span><details><summary aria-label="Account menu"><ChevronDown size={15} /></summary><div className="profile-popover"><span><strong>{user.email}</strong><small>Signed in as {roleLabels[user.role]}</small></span><button type="button" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div></details></div></div>
      </header>
      <main className="page-content"><Outlet /></main>
      <footer className="workspace-footer"><span>CLAN COMMAND <i>•</i> BUILT FOR THE CLAN THAT BUILDS TOGETHER</span><span>DEMO DATA STAYS IN THIS LOCAL WORKSPACE</span></footer>
    </div>
  </div>;
}

function ToastStack() {
  const { notices, dismissNotice } = useWorkspace();
  return <div className="toast-stack" aria-live="polite">{notices.map((notice) => <div key={notice.id} className={`toast ${notice.error ? 'toast--error' : ''}`}><span className="toast__mark">{notice.error ? '!' : '✓'}</span><span>{notice.text}</span><button aria-label="Dismiss notice" onClick={() => dismissNotice(notice.id)}><X size={15} /></button></div>)}</div>;
}

function AppRoutes() {
  const { authChecking, user, data } = useWorkspace();
  if (authChecking || (user && !data)) return <LoadingScreen />;
  return <>
    <Routes>
      <Route path="/login" element={<SignInPage />} />
      <Route path="/recruitment" element={<RecruitmentPage />} />
      <Route path="/app" element={user ? <WorkspaceLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="family" element={<FamilyHubPage />} />
        <Route path="applicants" element={<ProtectedRoute minimum="co_leader"><ApplicantsPage /></ProtectedRoute>} />
        <Route path="cwl" element={<ProtectedRoute minimum="co_leader"><CWLRoomPage /></ProtectedRoute>} />
        <Route path="events" element={<KotHEventsPage />} />
        <Route path="bases" element={<BaseBuilderPage />} />
        <Route path="members" element={<ProtectedRoute minimum="elder"><MembersPage /></ProtectedRoute>} />
        <Route path="members/:memberId" element={<MemberDetailPage />} />
        <Route path="clans" element={<ProtectedRoute minimum="leader"><ClanPage /></ProtectedRoute>} />
        <Route path="wars" element={<ProtectedRoute minimum="elder"><WarsPage /></ProtectedRoute>} />
        <Route path="readiness" element={<ProtectedRoute minimum="elder"><ReadinessPage /></ProtectedRoute>} />
        <Route path="progression" element={<HistoryPage />} />
        <Route path="ranked" element={<RankedPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="alerts" element={<ProtectedRoute minimum="elder"><AlertPage /></ProtectedRoute>} />
        <Route path="finder" element={<FinderPage />} />
        <Route path="discord" element={<ProtectedRoute minimum="leader"><IntegrationPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute minimum="leader"><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
      <Route path="/" element={<Navigate to={user ? '/app/dashboard' : '/recruitment'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/app/dashboard' : '/login'} replace />} />
    </Routes>
    <ToastStack />
  </>;
}

export default function App() {
  return <WorkspaceProvider><OperationsProvider><BrowserRouter><AppRoutes /></BrowserRouter></OperationsProvider></WorkspaceProvider>;
}
