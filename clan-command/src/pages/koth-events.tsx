import { useState, type FormEvent } from 'react';
import { Award, CalendarDays, Check, CircleHelp, Crown, Flag, Medal, Plus, Star, Target, Trophy, UsersRound, X } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Field, Modal, PageHeading, Panel, SelectField, TextAreaField } from '../components/ui';
import { useOperations, type EventStatus, type KotHEvent, type Rsvp } from '../operations-context';
import { useWorkspace } from '../workspace-context';
import { longDate } from './helpers';

const eventTones: Record<EventStatus, 'gold' | 'green' | 'blue'> = { registration: 'gold', live: 'green', complete: 'blue' };

export function KotHEventsPage() {
  const { data, user, notify } = useWorkspace();
  const ops = useOperations();
  const [createOpen, setCreateOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState<KotHEvent | null>(null);
  const [activeEventId, setActiveEventId] = useState(ops.events.find((event) => event.status === 'live')?.id || ops.events[0]?.id || '');
  if (!data || !user) return null;
  const activeEvents = ops.events.filter((event) => event.status === 'live');
  const events = [...ops.events].sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : a.date.localeCompare(b.date)));
  const activeEvent = events.find((event) => event.id === activeEventId) || events[0];
  const ownMember = data.members.find((member) => member.id === user.playerId);
  const ownTag = ownMember?.tag || `@${user.id}`;
  const canManage = user.role === 'leader' || user.role === 'co_leader';

  function createEvent(input: Omit<KotHEvent, 'id' | 'rsvps' | 'scores' | 'matchCount'>) {
    const newId = ops.addEvent(input);
    setActiveEventId(newId);
    setCreateOpen(false);
    notify('King of the Hill event created.');
  }

  function rsvp(event: KotHEvent, status: Rsvp) {
    ops.setRsvp(event.id, ownTag, status);
    notify(status === 'accepted' ? 'You are on the event roster.' : 'Your RSVP was updated to decline.');
  }

  return <div className="page-stack game-page koth-page">
    <PageHeading eyebrow="Clan events · live arena" title="King of the Hill" detail="Create a friendly ladder, rally the family and follow every match on the live board." actions={<>{activeEvents.length ? <Badge tone="green" dot>{activeEvents.length} EVENT{activeEvents.length === 1 ? '' : 'S'} LIVE</Badge> : <Badge tone="gold">EVENT HUB</Badge>}{canManage ? <Button leading={<Plus size={16}/>} onClick={() => setCreateOpen(true)}>Create event</Button> : null}</>} />

    <div className="game-koth-layout">
      <div className="game-koth-main">
        {activeEvent ? <Panel className="game-event-board"><div className="game-event-board__banner"><div className="game-event-board__mark"><Crown size={32} fill="currentColor"/><span>1</span></div><div className="game-event-board__title"><span className="game-ribbon">LIVE EVENT · KING OF THE HILL</span><h2>{activeEvent.title}</h2><p><CalendarDays size={14}/>{longDate(activeEvent.date)} <i>·</i> {activeEvent.startTime} <i>·</i> {Object.values(activeEvent.rsvps).filter((value) => value === 'accepted').length} accepted</p></div><Badge tone={eventTones[activeEvent.status]} dot>{activeEvent.status === 'live' ? 'LIVE NOW' : activeEvent.status === 'registration' ? 'RSVP OPEN' : 'COMPLETE'}</Badge>{canManage && activeEvent.status === 'registration' ? <Button size="sm" leading={<Flag size={13}/>} onClick={() => { ops.setEventStatus(activeEvent.id, 'live'); notify('The event is live. Match scoring is open.'); }}>Start event</Button> : null}{canManage && activeEvent.status === 'live' ? <Button size="sm" variant="outline" onClick={() => { ops.setEventStatus(activeEvent.id, 'complete'); notify('Event closed. Final standings are saved.'); }}>Close event</Button> : null}</div>
          <div className="game-event-rules"><CircleHelp size={16}/><span>{activeEvent.rules}</span><span className="game-event-rules__right">MATCHES <b>{activeEvent.matchCount}/{activeEvent.maxMatches}</b></span></div>
          <div className="game-event-progress"><div><span>Match progress</span><strong>{activeEvent.matchCount} <small>of {activeEvent.maxMatches}</small></strong></div><div className="game-event-progress__track"><span style={{ width: `${activeEvent.maxMatches ? activeEvent.matchCount / activeEvent.maxMatches * 100 : 0}%` }}/></div></div>
          <div className="game-leaderboard-heading"><div><span className="game-ribbon">LIVE STANDINGS</span><h3>Who wears the crown?</h3></div><div className="game-leaderboard-legend"><span><i/> Scores update as matches are recorded</span>{canManage && activeEvent.status === 'live' ? <Button variant="outline" size="sm" leading={<Target size={14}/>} onClick={() => setRecordTarget(activeEvent)}>Record match</Button> : null}</div></div>
          {activeEvent.scores.length ? <div className="game-leaderboard">{[...activeEvent.scores].sort((a, b) => b.score - a.score || b.wins - a.wins).map((score, index) => <div className={`game-leaderboard-row ${index === 0 ? 'game-leaderboard-row--first' : ''}`} key={score.tag}><span className={`game-leaderboard-rank game-leaderboard-rank--${index + 1}`}>{index === 0 ? <Crown size={15} fill="currentColor"/> : String(index + 1).padStart(2, '0')}</span><Avatar name={score.name} size="sm"/><span className="game-leaderboard-player"><strong>{score.name}</strong><small>{score.tag} <i>·</i> {score.clanName}</small></span><span className="game-leaderboard-record"><b>{score.wins}W <i>·</i> {score.losses}L</b><small>{score.played} MATCHES</small></span><span className="game-leaderboard-score"><strong>{score.score}</strong><small>PTS</small></span><span className="game-leaderboard-meter"><i style={{ width: `${Math.min(100, score.score / Math.max(1, activeEvent.scores[0]?.score) * 100)}%` }}/></span></div>)}</div> : <EmptyState icon={<Trophy size={21}/>} title="No match scores yet" detail="Record the first match to open the live standings."/>}
          {activeEvent.status === 'live' || activeEvent.status === 'registration' ? <div className="game-event-rsvp"><div><span className="game-event-rsvp__icon"><UsersRound size={17}/></span><span><strong>Your seat at the arena</strong><small>{ownMember ? `${ownMember.name} · ${ownMember.tag}` : user.displayName}</small></span></div><div><Button size="sm" className={activeEvent.rsvps[ownTag] === 'accepted' ? 'game-rsvp-active' : ''} leading={<Check size={14}/>} onClick={() => rsvp(activeEvent, 'accepted')}>{activeEvent.rsvps[ownTag] === 'accepted' ? 'Accepted' : 'Accept'}</Button><Button size="sm" variant="outline" className={activeEvent.rsvps[ownTag] === 'declined' ? 'game-rsvp-declined' : ''} leading={<X size={14}/>} onClick={() => rsvp(activeEvent, 'declined')}>{activeEvent.rsvps[ownTag] === 'declined' ? 'Declined' : 'Decline'}</Button></div></div> : null}
        </Panel> : <Panel><EmptyState icon={<Trophy size={22}/>} title="The arena is quiet" detail="Create the first event to start a new family challenge." action={canManage ? <Button onClick={() => setCreateOpen(true)} leading={<Plus size={14}/>}>Create event</Button> : undefined}/></Panel>}
      </div>

      <aside className="game-koth-side"><Panel className="game-event-list-panel"><div className="game-section-heading"><div><span className="game-ribbon">EVENT SCHEDULE</span><h2>Upcoming & live</h2></div><CalendarDays size={18}/></div><div className="game-event-list">{events.map((event) => <button key={event.id} className={`game-event-list-item ${activeEvent?.id === event.id ? 'is-selected' : ''}`} onClick={() => setActiveEventId(event.id)}><span className={`game-event-list-mark game-event-list-mark--${event.status}`}><Trophy size={15}/></span><span><strong>{event.title}</strong><small>{longDate(event.date)} · {event.startTime}</small><em>{Object.values(event.rsvps).filter((value) => value === 'accepted').length} accepted · {event.matchCount}/{event.maxMatches} matches</em></span><Badge tone={eventTones[event.status]}>{event.status === 'live' ? 'LIVE' : event.status === 'registration' ? 'RSVP' : 'DONE'}</Badge></button>)}{!events.length ? <p className="game-no-events">No events have been created yet.</p> : null}</div>{canManage ? <Button variant="outline" className="game-event-create-link" leading={<Plus size={14}/>} onClick={() => setCreateOpen(true)}>Create a new event</Button> : null}</Panel>
        <Panel className="game-koth-howto"><div className="game-section-heading"><div><span className="game-ribbon">HOW TO PLAY</span><h2>Battle for the crown</h2></div><Medal size={18}/></div><div className="game-howto-step"><span>01</span><p><strong>RSVP</strong><small>Accept or decline so leaders know who is in the arena.</small></p></div><div className="game-howto-step"><span>02</span><p><strong>Battle</strong><small>Earn match points with stars and wins. Every result counts.</small></p></div><div className="game-howto-step"><span>03</span><p><strong>Take the hill</strong><small>Top score at the end of the event claims the crown.</small></p></div><div className="game-howto-reward"><Award size={15}/> Standings update in this shared demo browser.</div></Panel></aside>
    </div>

    {createOpen && canManage ? <EventEditor onClose={() => setCreateOpen(false)} onCreate={createEvent}/> : null}
    {recordTarget && canManage ? <RecordMatchModal event={recordTarget} members={data.members.filter((member) => member.isActive)} onClose={() => setRecordTarget(null)} onRecord={(payload) => { ops.recordMatch(recordTarget.id, payload); setRecordTarget(null); notify('Match score added to the live board.'); }}/> : null}
  </div>;
}

function EventEditor({ onClose, onCreate }: { onClose: () => void; onCreate: (event: Omit<KotHEvent, 'id' | 'rsvps' | 'scores' | 'matchCount'>) => void }) {
  const date = new Date(); date.setDate(date.getDate() + 2);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(date.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('19:00');
  const [rules, setRules] = useState('Best of three attacks. Score attack stars and add one bonus point for a win. Highest total takes the hill.');
  const [maxMatches, setMaxMatches] = useState(20);
  const [startsLive, setStartsLive] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onCreate({ title: title.trim(), date: eventDate, startTime, rules: rules.trim(), maxMatches, status: startsLive ? 'live' : 'registration' }); }
  return <Modal title="Create a King of the Hill event" kicker="EVENT BUILDER" onClose={onClose} size="lg"><form className="game-form" onSubmit={submit}><div className="game-form-callout"><span><Crown size={18}/></span><p>Set the challenge. Members can RSVP and leaders can record match results on the live board.</p><Badge tone="gold">KOTH</Badge></div><div className="form-grid form-grid--two"><Field label="Event title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Iron Crown Trial" required maxLength={72}/><Field label="Event date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required/><Field label="Start time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required/><Field label="Match limit" type="number" min={1} max={100} value={maxMatches} onChange={(event) => setMaxMatches(Number(event.target.value))}/><TextAreaField label="Event rules" className="form-grid__wide" value={rules} onChange={(event) => setRules(event.target.value)} rows={4} maxLength={500} required/></div><label className="game-live-toggle"><input type="checkbox" checked={startsLive} onChange={(event) => setStartsLive(event.target.checked)}/><span><strong>Start the event live</strong><small>Turn off to collect RSVPs before match scoring begins.</small></span><i/></label><div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" leading={<Flag size={15}/>}>Create event</Button></div></form></Modal>;
}

function RecordMatchModal({ event, members, onClose, onRecord }: { event: KotHEvent; members: Array<{ id: string; tag: string; name: string; clanName: string }>; onClose: () => void; onRecord: (input: { tag: string; name: string; clanName: string; score: number; result: 'win' | 'loss' | 'draw' }) => void }) {
  const [tag, setTag] = useState(members[0]?.tag || '');
  const [stars, setStars] = useState(3);
  const [result, setResult] = useState<'win' | 'loss' | 'draw'>('win');
  const selected = members.find((member) => member.tag === tag);
  const score = event.scores.find((row) => row.tag === tag);
  function submit(formEvent: FormEvent<HTMLFormElement>) { formEvent.preventDefault(); if (!selected) return; onRecord({ tag: selected.tag, name: selected.name, clanName: selected.clanName, score: stars, result }); }
  return <Modal title="Record a match result" kicker="LIVE EVENT SCORING" onClose={onClose}><form className="game-form" onSubmit={submit}><SelectField label="Player base" value={tag} onChange={(event) => setTag(event.target.value)}>{members.map((member) => <option value={member.tag} key={member.id}>{member.name} · {member.tag} · {member.clanName}</option>)}</SelectField><div className="game-stars-select"><span>Attack stars</span><div>{[0,1,2,3].map((value) => <button type="button" aria-pressed={stars === value} className={stars === value ? 'is-selected' : ''} key={value} onClick={() => setStars(value)}>{value}<Star size={14} fill={stars >= value && value > 0 ? 'currentColor' : 'none'}/></button>)}</div></div><SelectField label="Match outcome" value={result} onChange={(event) => setResult(event.target.value as 'win' | 'loss' | 'draw')}><option value="win">Win · bonus point</option><option value="draw">Draw</option><option value="loss">Loss</option></SelectField><div className="game-record-preview"><span>New standings contribution</span><strong>{stars + (result === 'win' ? 1 : 0)} <small>points</small></strong><em>Current total: {score?.score || 0} points</em></div><div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" leading={<Check size={15}/>}>Add result to board</Button></div></form></Modal>;
}
