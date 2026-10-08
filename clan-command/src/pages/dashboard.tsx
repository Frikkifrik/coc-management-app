import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, ChevronRight, CircleDot, Crown, Flame, History as HistoryIcon, Shield, ShieldCheck, Sparkles, Swords, Target, Trophy, UsersRound, Zap } from 'lucide-react';
import { Badge, EmptyState, PageHeading, Panel, ProgressBar, StatCard } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { AppRole, ClanAlert, Member, ProgressEvent } from '../types';
import { readinessScore, readinessTone, relativeTime, shortDate, shortTime } from './helpers';

const roleRank: Record<AppRole, number> = { member: 1, elder: 2, co_leader: 3, leader: 4 };

function readinessLabel(score: number) { return score >= 82 ? 'Ready for war' : score >= 65 ? 'Almost there' : 'Needs attention'; }
function alertTone(alert: ClanAlert): 'red' | 'orange' | 'blue' {
  return alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue';
}

export function DashboardPage() {
  const { user, data } = useWorkspace();
  if (!user || !data) return null;
  const activeWars = data.wars.filter((war) => war.state === 'in_war');
  const nextWar = data.wars.filter((war) => war.state === 'preparation').sort((a,b) => a.startAt.localeCompare(b.startAt))[0];
  const roster = data.members.filter((member) => member.isActive);
  const warReady = roster.filter((member) => readinessScore(member, 'war').ready).length;
  const cwlReady = roster.filter((member) => readinessScore(member, 'cwl').ready).length;
  const openAlerts = data.alerts.filter((alert) => alert.status !== 'resolved');
  const urgent = openAlerts.filter((alert) => alert.severity === 'critical').length;
  const ownMember = data.members.find((member) => member.id === user.playerId);
  const canLead = roleRank[user.role] >= roleRank.elder;
  const canManage = roleRank[user.role] >= roleRank.co_leader;
  const winWars = data.wars.filter((war) => war.state === 'complete' && war.result === 'win').length;
  const completedWars = data.wars.filter((war) => war.state === 'complete').length;
  const winRate = completedWars ? Math.round(winWars / completedWars * 100) : 0;
  const ownWarSignal = ownMember ? readinessScore(ownMember, 'war') : null;
  const ownCwlSignal = ownMember ? readinessScore(ownMember, 'cwl') : null;
  const warMetric = canLead ? `${warReady}/${roster.length}` : ownWarSignal ? (ownWarSignal.ready ? 'Ready' : 'Review') : '—';
  const cwlMetric = canLead ? `${cwlReady}/${roster.length}` : ownCwlSignal ? (ownCwlSignal.ready ? 'Ready' : 'Review') : '—';
  const warHint = canLead ? (roster.length ? `${Math.round(warReady / roster.length * 100)}% attack-ready` : 'No bases yet') : 'Your regular war signal';
  const cwlHint = canLead ? 'Available · heroes · reliability' : 'Your CWL availability signal';
  const todayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());
  const dashboardBaseLink = canLead ? '/app/readiness' : user.playerId ? `/app/members/${user.playerId}` : '/app/finder';
  const activityData = [
    { day: 'M', value: 58 }, { day: 'T', value: 76 }, { day: 'W', value: 53 }, { day: 'T', value: 92 },
    { day: 'F', value: 71 }, { day: 'S', value: 84 }, { day: 'S', value: 64 },
  ];
  return <div className="dashboard-page">
    <PageHeading eyebrow={`${todayLabel} · Clan operations`} title={`Welcome back, ${user.displayName.split(' ')[0]}.`} detail="Your clans are moving. Here's the signal from across the family." actions={<><Badge tone="green" dot>Family online</Badge><span className="heading-date">{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date())}</span></>} />

    <section className="command-hero">
      <div className="command-hero__grain" />
      <div className="command-hero__copy"><Badge tone="gold" dot>FAMILY COMMAND</Badge><h2>The next star<br /><span>is yours to call.</span></h2><p>Three clans. One command view. Keep every base battle-ready and every call clear.</p><div className="command-hero__actions"><Link to={dashboardBaseLink} className="btn btn--primary">{canLead ? 'Open readiness board' : 'View my base'} <ArrowRight size={16} /></Link><Link to="/app/wars" className="text-link">Enter the war room <ChevronRight size={15} /></Link></div></div>
      <div className="command-hero__crest"><div className="crest-ring crest-ring--outer" /><div className="crest-ring crest-ring--inner" /><div className="crest-glow" /><span className="crest-shield"><Shield size={61} strokeWidth={1.2} fill="currentColor" /><Crown size={24} /></span><span className="crest-caption"><Flame size={13} /> RISE AS ONE <Flame size={13} /></span></div>
      <div className="command-hero__season"><span className="season-crown"><Crown size={14} /></span><span><small>SEASON VII · OCTOBER</small><strong>Rise of the Iron Crown</strong></span><span className="season-position">#03 <small>FAMILY RANK</small></span></div>
    </section>

    <section className="stat-grid" aria-label="Clan family summary">
      <StatCard icon={<UsersRound size={19} />} label="Active bases" value={roster.length} hint={`${data.clans.length} clans in the family`} tone="blue" />
      <StatCard icon={<ShieldCheck size={19} />} label="War ready" value={warMetric} hint={warHint} tone="green" />
      <StatCard icon={<Trophy size={19} />} label="CWL ready" value={cwlMetric} hint={cwlHint} tone="gold" />
      <StatCard icon={<BellRing size={19} />} label="Open alerts" value={openAlerts.length} hint={urgent ? `${urgent} needs leadership now` : 'No critical alerts'} tone={urgent ? 'red' : 'blue'} />
    </section>

    <div className="dashboard-grid dashboard-grid--primary">
      <Panel className="readiness-panel">
        <div className="panel-heading"><div><span className="eyebrow">READINESS PULSE</span><h2>Attack readiness</h2></div><Link className="panel-link" to={canLead ? '/app/readiness' : '/app/members'}>Full report <ArrowRight size={14} /></Link></div>
        {canLead ? <>
          <div className="readiness-overview"><div className="readiness-donut" style={{ '--readiness': `${roster.length ? Math.round(warReady / roster.length * 100) : 0}%` } as React.CSSProperties}><div><strong>{roster.length ? Math.round(warReady / roster.length * 100) : 0}<small>%</small></strong><span>WAR READY</span></div></div><div className="readiness-overview__detail"><strong>{warReady} bases cleared for battle</strong><span>{roster.length - warReady} need a check-in before the next matchup.</span><div className="readiness-counts"><span><i className="readiness-key readiness-key--ready" />Ready <b>{warReady}</b></span><span><i className="readiness-key readiness-key--review" />Review <b>{Math.max(0,roster.length-warReady)}</b></span></div></div></div>
          <div className="readiness-clans">{data.clans.map((clan, index) => { const clanMembers = roster.filter((member) => member.clanId === clan.id); const ready = clanMembers.filter((member) => readinessScore(member,'war').ready).length; const pct = clanMembers.length ? Math.round(ready/clanMembers.length*100) : 0; return <div className="readiness-clan" key={clan.id}><span className={`mini-clan-crest mini-clan-crest--${index}`}><Shield size={17} /></span><span className="readiness-clan__name"><strong>{clan.shortName || clan.name}</strong><small>{ready} of {clanMembers.length} ready</small></span><ProgressBar value={pct} tone={pct >= 78 ? 'green':'gold'} /><b>{pct}%</b></div>; })}</div>
        </> : <MemberReadiness member={ownMember} />}
      </Panel>

      <Panel className="battle-card">
        <div className="panel-heading"><div><span className="eyebrow">WAR ROOM · LIVE</span><h2>{activeWars.length ? 'Battle day' : 'Next matchup'}</h2></div><span className="live-wave"><i /> LIVE</span></div>
        {activeWars[0] ? <WarScore war={activeWars[0]} /> : nextWar ? <div className="next-war"><span className="next-war__crest"><Shield size={28} /></span><div><small>{nextWar.warType === 'cwl' ? 'CWL ROUND' : 'NEXT WAR'}</small><strong>{nextWar.opponent}</strong><span>{nextWar.clanName} · begins {shortDate(nextWar.startAt)} at {shortTime(nextWar.startAt)}</span></div><Badge tone="gold">PREP</Badge></div> : <EmptyState icon={<Swords size={20} />} title="No active wars" detail="Create the next matchup from the War Room." action={<Link className="text-link" to="/app/wars">Open War Room <ArrowRight size={14} /></Link>} />}
        <div className="battle-card__footer"><div><span className="battle-foot-icon"><Target size={15} /></span><span><small>30-DAY WAR RECORD</small><strong>{winWars}W · {data.wars.filter((war) => war.state === 'complete' && war.result === 'loss').length}L · {data.wars.filter((war) => war.state === 'complete' && war.result === 'draw').length}D</strong></span></div><div className="battle-winrate"><strong>{winRate}%</strong><span>WIN RATE</span></div></div>
      </Panel>
    </div>

    <div className="dashboard-grid dashboard-grid--secondary">
      <Panel className="family-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR CLANS</span><h2>Three banners. One family.</h2></div>{roleRank[user.role] >= roleRank.leader ? <Link className="panel-link" to="/app/clans">Manage clans <ArrowRight size={14} /></Link> : null}</div>
        <div className="family-clan-list">{data.clans.map((clan, index) => { const members = roster.filter((member) => member.clanId === clan.id); return <Link to={canLead ? '/app/clans' : '/app/finder'} className="family-clan-row" key={clan.id}><span className={`family-crest family-crest--${index}`}><Shield size={20} fill="currentColor" /></span><span className="family-clan-info"><strong>{clan.name}</strong><small>{clan.league} <i /> Level {clan.clanLevel}</small></span><span className="family-clan-members"><strong>{members.length}<small>/50</small></strong><span>members</span></span><span className="family-clan-streak"><Flame size={13} /> {clan.warWinStreak} win streak</span><ChevronRight size={17} className="row-chevron" /></Link>; })}</div>
      </Panel>
      <Panel className="activity-panel"><div className="panel-heading"><div><span className="eyebrow">SEVEN-DAY SIGNAL</span><h2>Clan activity</h2></div><Badge tone="green"><CircleDot size={11} /> +18% this week</Badge></div><div className="activity-chart"><div className="activity-chart__plot">{activityData.map((item,index) => <div className={`activity-chart__bar ${index===3?'activity-chart__bar--peak':''}`} key={`${item.day}-${index}`}><span style={{height:`${item.value}%`}} /></div>)}</div><div className="activity-chart__days">{activityData.map((item,index)=><span key={`${item.day}-${index}`}>{item.day}</span>)}</div></div><div className="activity-legend"><span><i /> Attack activity</span><strong>126 events <small>last 7 days</small></strong></div><div className="activity-facts"><div><span><Zap size={14} /></span><b>28</b><small>upgrades logged</small></div><div><span><Swords size={14} /></span><b>46</b><small>war hits used</small></div><div><span><Trophy size={14} /></span><b>12</b><small>ranked climbs</small></div></div></Panel>
    </div>

    <div className="dashboard-grid dashboard-grid--bottom">
      <Panel className="alerts-panel"><div className="panel-heading"><div><span className="eyebrow">LEADERSHIP QUEUE</span><h2>Needs your attention <Badge tone={urgent ? 'red':'muted'}>{openAlerts.length}</Badge></h2></div>{canLead ? <Link className="panel-link" to="/app/alerts">All alerts <ArrowRight size={14} /></Link> : null}</div>
        {openAlerts.length ? <div className="attention-list">{openAlerts.slice(0,4).map((alert) => <Link className="attention-row" key={alert.id} to="/app/alerts"><span className={`attention-icon attention-icon--${alertTone(alert)}`}><BellRing size={16} /></span><span className="attention-text"><strong>{alert.title}</strong><small>{alert.playerName || alert.clanName || alert.category.toUpperCase()} · {relativeTime(alert.createdAt)}</small></span><Badge tone={alertTone(alert)}>{alert.severity}</Badge><ChevronRight size={16} /></Link>)}</div> : <EmptyState icon={<ShieldCheck size={20} />} title="All clear" detail="No open alerts need a call right now." />}
      </Panel>
      <Panel className="history-panel"><div className="panel-heading"><div><span className="eyebrow">FAMILY TIMELINE</span><h2>Recent progression</h2></div><Link className="panel-link" to="/app/progression">View history <ArrowRight size={14} /></Link></div><div className="timeline-list">{data.history.slice(0,4).map((event,index) => <TimelineEvent key={event.id} event={event} index={index} />)}{!data.history.length ? <EmptyState icon={<HistoryIcon size={20} />} title="A fresh chapter" detail="Town Hall upgrades, promotions and milestones will appear here." /> : null}</div></Panel>
    </div>

    <div className="dashboard-bottom-callout"><span><Sparkles size={15} /> CLAN COMMAND TIP</span><p>Consistent attacks beat last-minute heroics. Keep war opt-ins honest and readiness stays useful.</p><Link className="btn btn--ghost btn--sm" to={canManage?'/app/readiness':'/app/rewards'}>See your next step <ArrowRight size={14} /></Link></div>
  </div>;
}

function MemberReadiness({ member }: { member?: Member }) {
  if (!member) return <EmptyState icon={<ShieldCheck size={20} />} title="No linked base" detail="Ask a Leader to link your portal account to your player tag." />;
  const war = readinessScore(member,'war'); const cwl = readinessScore(member,'cwl');
  return <div className="my-readiness"><div className="my-readiness__score"><strong>{war.score}<small>/100</small></strong><span>{readinessLabel(war.score)}</span><ProgressBar value={war.score} tone={readinessTone(war.score)} height="md" /></div><div className="my-readiness__checks"><div><span>Regular war</span><Badge tone={war.ready?'green':'orange'}>{war.ready?'READY':member.warOptIn?'CHECK':'OPTED OUT'}</Badge></div><div><span>CWL lineup</span><Badge tone={cwl.ready?'green':'orange'}>{cwl.ready?'READY':member.cwlOptIn?'CHECK':'OPTED OUT'}</Badge></div><div><span>Hero progress</span><b>{member.heroReadiness ?? '—'}%</b></div><div><span>30-day missed hits</span><b>{member.missedAttacks30d ?? '—'}</b></div></div></div>;
}

function WarScore({ war }: { war: import('../types').War }) {
  const remaining = Math.max(0, Math.ceil((new Date(war.endAt).getTime() - Date.now()) / 3_600_000));
  return <div className="war-score"><div className="war-score__timer"><span className="live-wave"><i /> IN BATTLE</span><span>{remaining > 0 ? `${remaining}h remaining` : 'Final results'}</span></div><div className="war-score__teams"><div><span className="war-team-crest"><Shield size={24} /></span><strong>{war.clanName}</strong><small>OUR FAMILY</small></div><div className="war-score__digits"><strong>{war.stars}</strong><i>:</i><strong>{war.opponentStars}</strong></div><div><span className="war-team-crest war-team-crest--opponent"><Shield size={24} /></span><strong>{war.opponent}</strong><small>OPPONENT</small></div></div><div className="war-score__progress"><div><span>Destruction</span><b>{war.destruction.toFixed(1)}%</b></div><ProgressBar value={war.destruction} tone="gold" height="md" /><div><span>Attacks used</span><b>{war.attacksUsed} / {war.warSize * 2}</b></div></div><Link to="/app/wars" className="war-room-link">Open battle details <ArrowRight size={14} /></Link></div>;
}

function TimelineEvent({ event, index }: { event: ProgressEvent; index: number }) {
  const icons = [<ArrowUpRight size={15} key="up" />,<Trophy size={15} key="trophy" />,<Sparkles size={15} key="spark" />,<ArrowDownRight size={15} key="down" />];
  return <div className="timeline-event"><span className={`timeline-event__icon timeline-event__icon--${index%4}`}>{icons[index%4]}</span><span className="timeline-event__copy"><strong>{event.title}</strong><small><b>{event.playerName}</b> · {event.clanName}{event.fromValue && event.toValue ? ` · ${event.fromValue} → ${event.toValue}` : ''}</small></span><time>{relativeTime(event.createdAt)}</time></div>;
}
