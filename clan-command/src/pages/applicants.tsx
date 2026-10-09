import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, BellRing, Check, Clock3, History, KeyRound, Search, Shield, Sparkles, Swords, Tag, UserRoundCheck, UsersRound } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, PageHeading, Panel } from '../components/ui';
import { apiRequest } from '../api';
import { useOperations } from '../operations-context';
import { useWorkspace } from '../workspace-context';
import { longDate, relativeTime } from './helpers';
import type { Member } from '../types';

type Mobility = { title: string; type: string; from: string | null; to: string | null; date: string };
type ApplicantProfile = {
  tag: string; name: string; townHall: number; trophies: number; clanName: string; clanTag: string;
  active: boolean; joinedAt: string; leftAt: string | null; returnCount: number; rushPercent: number;
  labPurity: number; threeStarRate: number; warStars: number;
  heroLevels: Record<string, number>;
  heroEquipment: Array<{ name: string; level: number }>;
  mobilityTimeline: Mobility[];
  mockMetrics?: boolean;
  metricsEstimated?: boolean;
};
type PublicLookup = { kind: 'player' | 'clan' | 'none'; items: ApplicantProfile[] };

const validTag = /^#?[0-9A-Z]{3,16}$/i;

export function ApplicantsPage() {
  const { data, notify } = useWorkspace();
  const ops = useOperations();
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [lookupKind, setLookupKind] = useState<'returning' | 'new' | 'unknown' | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const formerMembers = useMemo(() => (data?.members || []).filter((member) => !member.isActive).slice(0, 4), [data?.members]);

  async function inspect(event?: FormEvent<HTMLFormElement>, selectedTag?: string) {
    event?.preventDefault();
    const typed = (selectedTag ?? query).trim().toUpperCase();
    if (!validTag.test(typed)) { setError('Enter a valid #PLAYER tag (3–16 letters or numbers).'); return; }
    const tag = typed.startsWith('#') ? typed : `#${typed}`;
    setQuery(tag); setProfile(null); setError(''); setBusy(true); setLookupKind(null);
    ops.trackApplicantSearch(tag);
    try {
      const response = await apiRequest<PublicLookup>(`/api/public-search?q=${encodeURIComponent(tag)}`);
      const found = response.items.find((item) => item.tag.toUpperCase() === tag);
      if (found) {
        const localMember = data?.members.find((member) => member.tag.toUpperCase() === tag);
        const memberHistory = localMember ? data?.history.filter((item) => item.playerId === localMember.id).map((item) => ({ title: item.title, type: item.eventType, from: item.fromValue, to: item.toValue, date: item.createdAt })) || [] : [];
        const mobility = [...(found.mobilityTimeline || []), ...memberHistory].filter((item, index, all) => all.findIndex((candidate) => candidate.title === item.title && candidate.date === item.date) === index).sort((a, b) => a.date.localeCompare(b.date));
        const enriched = { ...found, mobilityTimeline: mobility };
        setProfile(enriched);
        const former = localMember ? !localMember.isActive || Boolean(localMember.leftAt) || Number(localMember.returnCount || 0) > 0 : !found.active || Boolean(found.leftAt) || Number(found.returnCount || 0) > 0;
        setLookupKind(former ? 'returning' : 'new');
      } else {
        const localMember = data?.members.find((member) => member.tag.toUpperCase() === tag);
        if (localMember) {
          setProfile(fromMember(localMember, data?.history.filter((item) => item.playerId === localMember.id).map((item) => ({ title: item.title, type: item.eventType, from: item.fromValue, to: item.toValue, date: item.createdAt })) || []));
          setLookupKind(!localMember.isActive || Number(localMember.returnCount || 0) > 0 ? 'returning' : 'new');
        } else {
          try {
            const live = await apiRequest<{ item: Record<string, unknown> }>(`/api/supercell/player/${encodeURIComponent(tag)}`);
            setProfile(fromSupercell(live.item, tag));
            setLookupKind('new');
          } catch {
            setLookupKind('unknown');
          }
        }
      }
    } catch (reason) {
      const localMember = data?.members.find((member) => member.tag.toUpperCase() === tag);
      if (localMember) {
        const history = data?.history.filter((item) => item.playerId === localMember.id).map((item) => ({ title: item.title, type: item.eventType, from: item.fromValue, to: item.toValue, date: item.createdAt })) || [];
        setProfile(fromMember(localMember, history));
        setLookupKind(localMember.isActive && Number(localMember.returnCount || 0) === 0 ? 'new' : 'returning');
      } else {
        setError(reason instanceof Error ? `Family cross-check unavailable: ${reason.message}` : 'The applicant lookup could not reach the local roster.');
      }
    } finally { setBusy(false); }
  }

  async function sendDiscordAlert() {
    if (!profile) return;
    setSending(true);
    const summary = formatApplicantMessage(profile, lookupKind === 'returning');
    try {
      const response = await apiRequest<{ delivered: boolean; message: string }>('/api/integrations/discord/dispatch', { method: 'POST', body: JSON.stringify({ kind: 'applicant', content: summary }) });
      if (response.delivered) notify('Applicant summary sent to Discord.');
      else {
        try { await navigator.clipboard.writeText(summary); } catch { /* Keep the card visible even without clipboard permissions. */ }
        notify('Discord is not connected. Applicant summary copied for sharing.');
      }
    } catch (reason) {
      try { await navigator.clipboard.writeText(summary); } catch { /* Clipboard is a best-effort local fallback. */ }
      notify(reason instanceof Error ? `Summary ready to copy: ${reason.message}` : 'Summary ready to copy.', true);
    } finally { setSending(false); }
  }

  return <div className="page-stack game-page applicant-page">
    <PageHeading eyebrow="Recruitment · leadership desk" title="Applicant Inspector" detail="Cross-check a requesting player tag against the full family history before you send an invite." actions={<Badge tone="gold" dot>LEADER TOOL</Badge>} />
    <section className="game-applicant-hero"><span className="game-applicant-hero__crest"><Search size={30}/><i><Sparkles size={13}/></i></span><div><span className="game-ribbon">IN-GAME JOIN REQUEST</span><h2>Is this a new recruit<br/>or a familiar face?</h2><p>Inspect former memberships, name changes, clan moves and account progression in one pass.</p></div><div className="game-applicant-hero__facts"><span><History size={14}/> Family history</span><span><UsersRound size={14}/> Alt-account changes</span><span><Shield size={14}/> Roster match</span></div></section>

    <Panel className="game-applicant-search"><form onSubmit={(event) => void inspect(event)}><label className="game-applicant-input"><Tag size={19}/><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Enter requesting #PLAYERTAG" aria-label="Applicant player tag" autoComplete="off"/><kbd>↵</kbd></label><Button type="submit" leading={<Search size={15}/>} disabled={busy}>{busy ? 'Inspecting tag…' : 'Inspect applicant'}</Button></form>{error ? <p className="game-form-error" role="alert">{error}</p> : null}<div className="game-applicant-samples"><span>TRY A FORMER MEMBER</span>{formerMembers.length ? formerMembers.map((member) => <button key={member.id} onClick={() => void inspect(undefined, member.tag)}>{member.tag} <ArrowRight size={12}/></button>) : <span className="game-applicant-no-samples">Former-member demo records appear here.</span>}</div></Panel>

    {busy ? <Panel className="game-applicant-loading"><span className="spinner"/><div><strong>Checking the family archives…</strong><small>Matching account tags, join dates, name changes and past clans.</small></div></Panel> : null}
    {!busy && profile ? <ApplicantResult profile={profile} kind={lookupKind} onSend={() => void sendDiscordAlert()} sending={sending}/> : null}
    {!busy && lookupKind === 'unknown' ? <Panel className="game-applicant-empty"><EmptyState icon={<AlertTriangle size={22}/>} title="No previous family record" detail={`${query} is not in the saved roster or known history. The player can be treated as a new applicant; a live Supercell profile is only available when the server API proxy is configured.`}/><div className="game-applicant-empty__note"><Shield size={15}/> No roster data was found for this tag. No personal information is exposed by the public lookup.</div></Panel> : null}
    {!busy && !profile && !lookupKind && !error ? <div className="game-applicant-empty-grid"><Panel><span className="game-empty-icon"><UserRoundCheck size={20}/></span><span className="game-ribbon">RETURNING MEMBER CHECK</span><h3>Catch the familiar faces.</h3><p>Former members stay searchable with their past join and leave dates, names and clan history.</p></Panel><Panel><span className="game-empty-icon game-empty-icon--gold"><BellRing size={20}/></span><span className="game-ribbon">DISCORD ALERT CARD</span><h3>Keep the team in sync.</h3><p>Send a tidy applicant summary to the leadership channel or copy it when a webhook is not configured.</p></Panel></div> : null}
  </div>;
}

function ApplicantResult({ profile, kind, onSend, sending }: { profile: ApplicantProfile; kind: 'returning' | 'new' | 'unknown' | null; onSend: () => void; sending: boolean }) {
  const returning = kind === 'returning';
  const nameChanges = profile.mobilityTimeline.filter((event) => event.type === 'name_change');
  const mobility = profile.mobilityTimeline.filter((event) => ['roster_join','roster_return','roster_departure','clan_transfer'].includes(event.type));
  const heroes = Object.entries(profile.heroLevels || {}).slice(0, 4);
  const membershipEvents = new Set(['roster_join','roster_return','roster_departure','clan_transfer']);
  const accountChanges = profile.mobilityTimeline.filter((event) => !membershipEvents.has(event.type) && (!profile.leftAt || new Date(event.date) > new Date(profile.leftAt)));
  return <div className="game-applicant-result">
    <Panel className="game-applicant-profile"><div className="game-applicant-profile__status"><span className="game-ribbon">FAMILY CROSS-CHECK</span><Badge tone={returning ? 'gold' : 'green'} dot>{returning ? 'RETURNING FAMILY MEMBER' : 'NO FORMER MEMBERSHIP'}</Badge></div><div className="game-applicant-profile__identity"><Avatar name={profile.name} size="lg" className="game-applicant-profile__avatar"/><div><h2>{profile.name}</h2><span>{profile.tag} <i>·</i> TH {profile.townHall} <i>·</i> {profile.clanName || 'No current clan'}</span><div className="game-applicant-profile__subbadges"><Badge tone={profile.active ? 'green' : 'muted'}>{profile.active ? 'ACTIVE IN FAMILY' : 'FORMER MEMBER'}</Badge>{profile.returnCount ? <Badge tone="blue">{profile.returnCount} PREVIOUS RETURN{profile.returnCount === 1 ? '' : 'S'}</Badge> : null}<Badge tone="neutral">{profile.mockMetrics ? 'DEMO PROFILE' : profile.metricsEstimated ? 'LIVE · ESTIMATED STATS' : 'LIVE PROFILE'}</Badge></div></div><Button leading={<BellRing size={15}/>} onClick={onSend} disabled={sending}>{sending ? 'Sending alert…' : 'Send Alert to Discord'}</Button></div><div className="game-applicant-stat-strip"><div><strong>{profile.leftAt ? longDate(profile.leftAt) : 'No'}</strong><span>LAST LEFT</span></div><div><strong>{profile.returnCount}</strong><span>RETURNS</span></div><div><strong>{profile.rushPercent}%</strong><span>RUSH ESTIMATE</span></div><div><strong>{profile.labPurity}%</strong><span>LAB PURITY</span></div><div><strong>{profile.threeStarRate}%</strong><span>WAR 3★ RATE</span></div></div></Panel>

    <div className="game-applicant-details"><Panel><div className="game-section-heading"><div><span className="game-ribbon">ACCOUNT CHANGES</span><h3>Since their last visit</h3></div><KeyRound size={17}/></div><div className="game-applicant-change-grid"><div><span>Current Town Hall</span><strong>TH {profile.townHall}</strong><small>{returning ? 'Progression has moved since departure.' : 'Current public village snapshot.'}</small></div><div><span>Home village trophies</span><strong>{profile.trophies.toLocaleString()}</strong><small>{profile.warStars.toLocaleString()} career war stars</small></div><div><span>Hero equipment</span><strong>{profile.heroEquipment.length} tracked</strong><small>{profile.heroEquipment.slice(0, 2).map((item) => `${item.name} Lv ${item.level}`).join(' · ')}</small></div><div><span>Current roster</span><strong>{profile.active ? profile.clanName : 'Former / outside family'}</strong><small>{profile.clanTag || 'No clan tag on file'}</small></div></div><div className="game-applicant-hero-levels">{heroes.map(([name, level]) => <span key={name}><i>{name.slice(0, 2).toUpperCase()}</i><small>{name}</small><b>{level}</b></span>)}</div><div className="game-applicant-since-left"><div><strong>{profile.leftAt ? 'CHANGES SINCE LAST LEFT' : 'RECENT ACCOUNT CHANGES'}</strong><span>{accountChanges.length} tracked</span></div>{accountChanges.length ? accountChanges.map((change, index) => <span key={`${change.date}-${index}`}><b>{change.title}</b><small>{change.from && change.to ? `${change.from} → ${change.to}` : change.to || change.from || 'Profile update'} · {relativeTime(change.date)}</small></span>) : <p>No account edits are recorded after the last departure.</p>}</div></Panel>
      <Panel><div className="game-section-heading"><div><span className="game-ribbon">MEMBERSHIP & NAME HISTORY</span><h3>Clan mobility timeline</h3></div><Clock3 size={17}/></div>{nameChanges.length ? <div className="game-name-change-callout"><span><History size={15}/></span><div><strong>{nameChanges.length} recorded name change{nameChanges.length === 1 ? '' : 's'}</strong><small>{nameChanges.map((event) => `${event.from || 'Unknown'} → ${event.to || profile.name}`).join(' · ')}</small></div></div> : <div className="game-name-change-callout game-name-change-callout--quiet"><span><Check size={15}/></span><div><strong>No saved name changes</strong><small>New changes are tracked automatically when leadership updates a roster profile.</small></div></div>}{mobility.length ? <div className="game-mobility-list">{mobility.map((event, index) => <div className="game-mobility-row" key={`${event.date}-${event.title}-${index}`}><i className={event.type === 'roster_departure' ? 'is-departure' : event.type === 'roster_return' ? 'is-return' : ''}/><span><strong>{event.title}</strong><small>{event.from && event.to ? `${event.from} → ${event.to}` : event.to || event.from || profile.clanName}</small></span><time>{longDate(event.date)}<small>{relativeTime(event.date)}</small></time></div>)}</div> : <div className="game-applicant-no-history">No previous clan moves are attached to this tag.</div>}</Panel></div>

    <div className="game-applicant-footnote"><Sparkles size={14}/><span>Rush, lab and equipment figures are synthetic demo metrics until a live Supercell key and static-egress proxy are configured.</span><Button variant="outline" size="sm" leading={<Swords size={14}/>} onClick={onSend}>Share applicant card <ArrowRight size={13}/></Button></div>
  </div>;
}

function fromMember(member: Member, history: Mobility[]): ApplicantProfile {
  const seed = [...member.tag].reduce((value, char) => value + char.charCodeAt(0), 0);
  const names = ['Giant Gauntlet','Rage Vial','Frozen Arrow','Healer Puppet'];
  return {
    tag: member.tag, name: member.name, townHall: member.townHall, trophies: member.trophies, clanName: member.clanName, clanTag: '',
    active: member.isActive, joinedAt: member.joinedAt, leftAt: member.leftAt || null, returnCount: member.returnCount || 0,
    rushPercent: Math.max(0, Math.min(100, 48 - Math.round(member.heroReadiness * 0.35) + seed % 11)),
    labPurity: Math.max(35, Math.min(100, Math.round(member.heroReadiness * 0.7 + seed % 13))),
    threeStarRate: Math.round(Math.max(0, Math.min(100, (member.averageStars90d || 1.8) / 3 * 100))),
    warStars: member.warStars, heroLevels: { ...(member.heroLevels || {}) }, heroEquipment: names.map((name, index) => ({ name, level: 9 + (seed + index * 7) % 18 })),
    mobilityTimeline: history, mockMetrics: true,
  };
}

function fromSupercell(item: Record<string, unknown>, requestedTag: string): ApplicantProfile {
  const playerTag = typeof item.tag === 'string' ? item.tag : requestedTag;
  const liveHeroes = Array.isArray(item.heroes) ? item.heroes as Array<{ name?: string; level?: number; equipment?: Array<{ name?: string; level?: number }> }> : [];
  const heroLevels = Object.fromEntries(liveHeroes.map((hero) => [(hero.name || 'Hero').toLowerCase().replace(/[^a-z]/g, ''), Number(hero.level || 0)]));
  const equipmentList = liveHeroes.flatMap((hero) => (hero.equipment || []).map((gear) => ({ name: gear.name || 'Hero Equipment', level: Number(gear.level || 1) }))).slice(0, 4);
  const clan = item.clan && typeof item.clan === 'object' ? item.clan as Record<string, unknown> : {};
  const seed = [...playerTag].reduce((value, char) => value + char.charCodeAt(0), 0);
  const townHall = Number(item.townHallLevel || 1);
  return {
    tag: playerTag, name: String(item.name || 'Unknown player'), townHall,
    trophies: Number(item.trophies || 0), clanName: String(clan.name || 'No current clan'), clanTag: String(clan.tag || ''),
    active: Boolean(clan.tag), joinedAt: new Date().toISOString(), leftAt: null, returnCount: 0,
    rushPercent: Math.max(1, Math.min(99, Math.round(47 - townHall * 1.9 + seed % 12))),
    labPurity: Math.max(35, Math.min(99, Math.round(54 + townHall * 2 + seed % 12))),
    threeStarRate: Math.max(0, Math.min(99, 50 + seed % 40)),
    warStars: Number(item.warStars || 0), heroLevels,
    heroEquipment: equipmentList.length ? equipmentList : [{ name: 'Equipment data unavailable', level: 0 }],
    mobilityTimeline: [], metricsEstimated: true,
  };
}

function formatApplicantMessage(profile: ApplicantProfile, returning: boolean) {
  const membership = returning ? `Returning family member · left ${profile.leftAt ? longDate(profile.leftAt) : 'date unknown'} · ${profile.returnCount} previous return(s)` : 'No previous family membership found';
  return [`🛡️ JOIN REQUEST · ${profile.name} · ${profile.tag}`, membership, `Town Hall ${profile.townHall} · ${profile.trophies.toLocaleString()} trophies · ${profile.clanName || 'No clan'}`, `Rush estimate ${profile.rushPercent}% · lab purity ${profile.labPurity}% · war 3-star rate ${profile.threeStarRate}%`, `Family mobility records: ${profile.mobilityTimeline.length}`, 'Review in the Applicant Inspector before inviting.'].join('\n').slice(0, 1700);
}
