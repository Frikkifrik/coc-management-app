import { useMemo, useState } from 'react';
import { ArrowRight, Check, Clipboard, Crown, LockKeyhole, Shield, Shuffle, Star, Swords, Trophy, UsersRound, WandSparkles } from 'lucide-react';
import { Avatar, Badge, Button, Modal, PageHeading, Panel, ProgressBar } from '../components/ui';
import { apiRequest } from '../api';
import { useOperations, type ClanIndex } from '../operations-context';
import { useWorkspace } from '../workspace-context';
import { readinessScore } from './helpers';
import type { Member } from '../types';

const clanTone = ['main', 'feeder', 'academy'];
const equipment = [
  { name: 'Giant Gauntlet', hero: 'BK' }, { name: 'Rage Vial', hero: 'BK' },
  { name: 'Frozen Arrow', hero: 'AQ' }, { name: 'Healer Puppet', hero: 'AQ' },
  { name: 'Eternal Tome', hero: 'GW' }, { name: 'Life Gem', hero: 'GW' },
];
const heroNames: Array<[keyof Member['heroLevels'], string]> = [['king','King'],['queen','Queen'],['warden','Warden'],['champion','Champion']];

function gearLevel(member: Member, index: number) {
  const seed = [...member.tag].reduce((sum, char) => sum + char.charCodeAt(0), index * 7);
  return Math.max(1, Math.min(27, Math.round(7 + member.townHall * 0.9 + (seed % 9))));
}

export function CWLRoomPage() {
  const { data, user, notify } = useWorkspace();
  const ops = useOperations();
  const [confirmLock, setConfirmLock] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligible = useMemo(() => (data?.members || []).filter((member) => member.isActive && member.cwlOptIn), [data?.members]);
  if (!data || !user) return null;
  const workspaceData = data;
  const current = data.members.find((member) => member.tag === ops.cwl.drawnTag) || null;
  const placed = Object.entries(ops.cwl.placements).map(([tag, clanIndex]) => ({ member: data.members.find((member) => member.tag === tag), tag, clanIndex })).filter((row) => row.member);
  const unplacedCount = Math.max(0, eligible.length - placed.length);
  const canSuggest = user.role === 'leader' || user.role === 'co_leader';
  const canLock = user.role === 'leader';
  const drawnCount = ops.cwl.drawnTags.filter((tag, index, all) => all.indexOf(tag) === index).length;
  const eventDate = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());

  function drawPlayer() {
    if (!eligible.length) return;
    const remaining = eligible.filter((member) => !ops.cwl.drawnTags.includes(member.tag));
    const pool = remaining.length ? remaining : eligible;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    ops.drawNextPlayer(pick.tag);
    document.getElementById('cwl-player-spotlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function buildMessage() {
    const lines = [`⚔️ MISCLICKED FAMILY · CWL ROSTER LOCKED · ${eventDate.toUpperCase()}`, ''];
    workspaceData.clans.slice(0, 3).forEach((clan, clanIndex) => {
      lines.push(`CLAN ${clanIndex + 1} · ${clan.name}`);
      const players = placed.filter((row) => row.clanIndex === clanIndex).map((row) => row.member!).sort((a, b) => b.townHall - a.townHall);
      if (!players.length) lines.push('  No placements suggested yet.');
      players.forEach((member, index) => lines.push(`  ${String(index + 1).padStart(2, '0')}. ${member.name} · ${member.tag} · TH${member.townHall}`));
      lines.push('');
    });
    lines.push(`UNASSIGNED · ${unplacedCount} CWL-eligible bases`);
    return lines.join('\n').slice(0, 1800);
  }

  async function confirmAndLock() {
    const message = buildMessage();
    ops.lockRoster(message);
    setConfirmLock(false);
    setShowMessage(true);
    setBusy(true);
    try {
      const response = await apiRequest<{ delivered: boolean; message: string }>('/api/integrations/discord/dispatch', { method: 'POST', body: JSON.stringify({ kind: 'cwl', content: message }) });
      if (response.delivered) notify('Roster locked and sent to Discord.');
      else {
        await copyMessage(message, false);
        notify('Roster locked. Discord is not connected, so the message was copied locally.');
      }
    } catch {
      await copyMessage(message, false);
      notify('Roster locked. Copy the generated message below to share it.', true);
    } finally { setBusy(false); }
  }

  async function copyMessage(message = ops.cwl.rosterMessage, showToast = true) {
    try {
      await navigator.clipboard.writeText(message);
      if (showToast) notify('CWL roster message copied.');
    } catch {
      if (showToast) notify('Clipboard access is unavailable. Select the roster text below.', true);
    }
  }

  return <div className="page-stack game-page cwl-page">
    <PageHeading eyebrow="War room · Clan War League" title="CWL War Room" detail="Draft the family lineups together, then lock the final roster for battle." actions={<><Badge tone={ops.cwl.locked ? 'red' : 'green'} dot>{ops.cwl.locked ? 'ROSTER LOCKED' : 'DRAFT OPEN'}</Badge><Button leading={<Shuffle size={16}/>} onClick={drawPlayer} disabled={!eligible.length}>{ops.cwl.drawnTags.length ? 'Next player' : 'Draw random card'}</Button></>} />

    <section className="game-cwl-banner"><div className="game-cwl-banner__crest"><Trophy size={35} fill="currentColor"/><span>✦</span></div><div className="game-cwl-banner__copy"><span className="game-ribbon">CWL PLANNING · {eventDate.toUpperCase()}</span><h2>Choose your champions.</h2><p>Draw a card, review the war stats and suggest a clan placement.</p></div><div className="game-cwl-banner__progress"><strong>{placed.length}<small> / {eligible.length}</small></strong><span>PLACEMENTS SUGGESTED</span><ProgressBar value={eligible.length ? placed.length / eligible.length * 100 : 0} tone="gold" height="md"/></div></section>

    <div className="game-cwl-layout">
      <div className="game-cwl-main">
        <Panel className="game-draw-panel" id="cwl-player-spotlight">
          <div className="game-section-heading"><div><span className="game-ribbon">THE NEXT PLAYER</span><h2>{current ? 'Card on the table' : 'Draw a score card'}</h2></div><span className="game-draw-count"><Shuffle size={14}/> {drawnCount} DRAWN</span></div>
          {current ? <PlayerSpotlight member={current} clans={data.clans} placement={ops.cwl.placements[current.tag]} suggestedBy={ops.cwl.suggestedBy[current.tag]} canSuggest={canSuggest} locked={ops.cwl.locked} onSuggest={(clan) => ops.suggestPlacement(current.tag, clan, user.displayName)}/> : <div className="game-draw-empty"><span className="game-draw-empty__icon"><WandSparkles size={27}/></span><div><strong>Ready to plan your CWL lineup?</strong><small>{eligible.length} opted-in bases are eligible for a card draw.</small></div><Button leading={<Shuffle size={15}/>} onClick={drawPlayer} disabled={!eligible.length}>Draw first player</Button></div>}
        </Panel>

        <Panel className="game-scorecard-panel"><div className="game-section-heading"><div><span className="game-ribbon">PLAYER SCORE CARDS</span><h2>Eligible bases <span>{eligible.length}</span></h2></div><div className="game-scorecard-legend"><span><i className="game-legend-dot game-legend-dot--green"/>Ready</span><span><i className="game-legend-dot game-legend-dot--gold"/>Review</span></div></div>
          <div className="game-scorecard-grid">{eligible.map((member) => <ScoreCard key={member.id} member={member} selected={member.tag === ops.cwl.drawnTag} placement={ops.cwl.placements[member.tag]} clan={data.clans[ops.cwl.placements[member.tag] ?? 0]} onDraw={() => ops.drawNextPlayer(member.tag)}/>)}</div>
        </Panel>
      </div>

      <aside className="game-cwl-sidebar">
        <Panel className="game-placement-board"><div className="game-section-heading"><div><span className="game-ribbon">PLACEMENT BOARD</span><h2>Three clan banners</h2></div><Shield size={20}/></div><p className="game-panel-intro">{canSuggest ? 'Co-leaders can suggest a destination from any score card.' : 'Review the latest co-leader placement suggestions.'}</p>
          <div className="game-placement-columns">{data.clans.slice(0, 3).map((clan, index) => {
            const players = placed.filter((row) => row.clanIndex === index);
            return <section className={`game-placement-lane game-placement-lane--${clanTone[index]}`} key={clan.id}><header><span><Shield size={15} fill="currentColor"/><b>CLAN {index + 1}</b></span><strong>{clan.name}</strong><small>{players.length} suggested · {index === 0 ? '30' : '30'} capacity</small></header>{players.length ? players.map(({ member, tag }) => <div className="game-placement-player" key={tag}><Avatar name={member!.name} size="sm"/><span><strong>{member!.name}</strong><small>TH{member!.townHall} · by {ops.cwl.suggestedBy[tag] || 'Leadership'}</small></span><Badge tone="gold">{member!.tag.slice(-4)}</Badge></div>) : <div className="game-placement-empty"><span>+</span><small>Suggest a player<br/>to this clan</small></div>}</section>;
          })}</div>
          <div className="game-placement-footer"><UsersRound size={15}/><span>{unplacedCount} bases not placed</span><span>{eligible.length} eligible</span></div>
          {canLock ? <Button className="game-lock-button" leading={ops.cwl.locked ? <LockKeyhole size={16}/> : <Crown size={16}/>} disabled={ops.cwl.locked || placed.length === 0 || busy} onClick={() => setConfirmLock(true)}>{ops.cwl.locked ? 'Roster confirmed & locked' : 'Confirm & lock roster'}</Button> : <p className="game-leader-only"><LockKeyhole size={13}/> Main Leader confirms and locks the CWL lineup.</p>}
          {ops.cwl.locked ? <div className="game-roster-locked"><span><LockKeyhole size={15}/></span><div><strong>Roster locked</strong><small>{ops.cwl.lockedAt ? new Date(ops.cwl.lockedAt).toLocaleString() : 'Confirmed by Leader'}</small></div><button onClick={() => setShowMessage(true)}>View message <ArrowRight size={13}/></button></div> : null}
        </Panel>

        <Panel className="game-cwl-rules"><div className="game-section-heading"><div><span className="game-ribbon">DRAFT RULES</span><h2>Keep it fair</h2></div><Swords size={19}/></div><ul><li>Score cards show current Town Hall and hero levels.</li><li>Equipment values are demo estimates until connected to a live game API.</li><li>Every clan placement is a suggestion until the Main Leader locks it.</li></ul><div className="game-cwl-rules__note"><Star size={14} fill="currentColor"/> 3-star rate uses the last 90 days of saved war data.</div></Panel>
      </aside>
    </div>

    {confirmLock ? <Modal title="Lock this CWL roster?" kicker="LEADER CONFIRMATION" onClose={() => setConfirmLock(false)}><div className="game-lock-confirm"><span><LockKeyhole size={24}/></span><p>This freezes all clan placements across this browser's draft. A formatted lineup message will be sent to Discord when configured, or shown for copying.</p><div className="game-lock-confirm__summary"><strong>{placed.length} players placed</strong><span>{unplacedCount} still unassigned</span></div><div className="form-actions"><Button variant="ghost" onClick={() => setConfirmLock(false)}>Back to draft</Button><Button onClick={() => void confirmAndLock()} leading={<Check size={15}/>}>Confirm lock</Button></div></div></Modal> : null}
    {showMessage ? <Modal title="CWL roster message" kicker={ops.cwl.locked ? 'LOCKED MESSAGE' : 'ROSTER PREVIEW'} onClose={() => setShowMessage(false)}><div className="game-message-preview"><textarea readOnly value={ops.cwl.locked ? ops.cwl.rosterMessage : buildMessage()} aria-label="Formatted CWL roster message"/><Button leading={<Clipboard size={15}/>} onClick={() => void copyMessage(ops.cwl.locked ? ops.cwl.rosterMessage : buildMessage())}>Copy message</Button></div></Modal> : null}
  </div>;
}

function PlayerSpotlight({ member, clans, placement, suggestedBy, canSuggest, locked, onSuggest }: { member: Member; clans: Array<{ id: string; name: string }>; placement?: ClanIndex; suggestedBy?: string; canSuggest: boolean; locked: boolean; onSuggest: (clan: ClanIndex) => void }) {
  const signal = readinessScore(member, 'cwl');
  return <div className="game-player-spotlight"><div className="game-player-spotlight__head"><div className="game-th-emblem"><strong>{member.townHall}</strong><small>TH</small></div><div><span className="game-ribbon">SCORE CARD · {member.tag}</span><h3>{member.name}</h3><p>{member.clanName} <i>·</i> {member.rankedTier} <i>·</i> {member.trophies.toLocaleString()} trophies</p></div><Badge tone={signal.ready ? 'green' : 'orange'} dot>{signal.ready ? 'CWL READY' : 'REVIEW'}</Badge></div><div className="game-hero-levels">{heroNames.map(([key, label]) => <div key={key}><span>{label.slice(0, 2).toUpperCase()}</span><small>{label}</small><strong>{member.heroLevels?.[key] || 0}</strong></div>)}</div><div className="game-spotlight-stats"><div><strong>{Math.round(Math.min(100, (member.averageStars90d || 0) / 3 * 100))}%</strong><span>3-STAR ATTACK RATE</span></div><div><strong>{member.averageDestruction90d?.toFixed(1) || '—'}%</strong><span>AVG DESTRUCTION</span></div><div><strong>{member.warEntries90d || 0}</strong><span>WARS · 90 DAYS</span></div></div><div className="game-equipment-row"><strong>HERO EQUIPMENT</strong>{equipment.slice(0, 4).map((item, index) => <span key={item.name} title={item.name}><i>{item.hero}</i><b>{gearLevel(member, index)}</b><small>{item.name}</small></span>)}</div><div className="game-spotlight-placement"><span>{placement === undefined ? 'Suggest a clan placement' : `Suggested for ${clans[placement]?.name || `Clan ${placement + 1}`}${suggestedBy ? ` · ${suggestedBy}` : ''}`}</span><div>{clans.slice(0, 3).map((clan, index) => <button type="button" key={clan.id} disabled={!canSuggest || locked} className={placement === index ? `is-selected game-place-${clanTone[index]}` : ''} onClick={() => onSuggest(index as ClanIndex)}><Shield size={13}/>{index + 1}</button>)}</div></div></div>;
}

function ScoreCard({ member, selected, placement, clan, onDraw }: { member: Member; selected: boolean; placement?: ClanIndex; clan?: { name: string }; onDraw: () => void }) {
  const readiness = readinessScore(member, 'cwl');
  const threeStar = Math.round(Math.min(100, (member.averageStars90d || 0) / 3 * 100));
  return <article className={`game-score-card ${selected ? 'game-score-card--selected' : ''}`}>
    <div className="game-score-card__top"><div className="game-th-emblem game-th-emblem--sm"><strong>{member.townHall}</strong><small>TH</small></div><span><strong>{member.name}</strong><small>{member.tag}</small></span><Badge tone={readiness.ready ? 'green' : 'gold'}>{readiness.ready ? 'READY' : 'CHECK'}</Badge></div>
    <div className="game-score-card__hero-row">{heroNames.map(([key, label]) => <span key={key} title={label}><i>{label.slice(0, 2).toUpperCase()}</i><b>{member.heroLevels?.[key] || 0}</b></span>)}</div>
    <div className="game-score-card__equipment">{equipment.slice(0, 4).map((item, index) => <span key={item.name} title={`${item.name} · Lv ${gearLevel(member, index)}`}><i>{item.hero}</i>{gearLevel(member, index)}</span>)}</div>
    <div className="game-score-card__footer"><span><Star size={12} fill="currentColor"/> {threeStar}% <small>3★ rate</small></span>{placement !== undefined && clan ? <Badge tone="blue">{clan.name}</Badge> : <button onClick={onDraw}>View card <ArrowRight size={12}/></button>}</div>
  </article>;
}
