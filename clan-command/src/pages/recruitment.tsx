import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Award, ExternalLink, FlaskConical, Search, Shield, Swords, Tag, Trophy, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Button, EmptyState, Panel, ProgressBar } from '../components/ui';
import { apiRequest } from '../api';
import { longDate, relativeTime } from './helpers';

interface PublicProfile {
  tag: string; name: string; townHall: number; trophies: number; clanName: string; clanTag: string;
  active: boolean; joinedAt: string; leftAt: string | null; returnCount: number; rushPercent: number;
  labPurity: number; threeStarRate: number; warStars: number;
  heroLevels: Record<string, number>;
  heroEquipment: Array<{ name: string; level: number }>;
  mobilityTimeline: Array<{ title: string; type: string; from: string | null; to: string | null; date: string }>;
  mockMetrics?: boolean;
}
interface SearchReply { kind: 'player' | 'clan' | 'none'; query: string; clan?: { name: string; tag: string; clanLevel: number; league: string; trophies: number }; items: PublicProfile[]; }

const mockProfiles: PublicProfile[] = [
  { tag: '#Q0P0Y2L8V', name: 'Ash Signal', townHall: 17, trophies: 5310, clanName: 'Misclicked Main', clanTag: '#2Q0P2YLRG', active: true, joinedAt: '2026-08-04T12:00:00.000Z', leftAt: null, returnCount: 1, rushPercent: 8, labPurity: 93, threeStarRate: 87, warStars: 2140, heroLevels: { king: 90, queen: 92, warden: 65, champion: 40 }, heroEquipment: [{ name: 'Giant Gauntlet', level: 26 }, { name: 'Rage Vial', level: 25 }, { name: 'Frozen Arrow', level: 23 }, { name: 'Eternal Tome', level: 24 }], mobilityTimeline: [{ title: 'Returned to the family', type: 'roster_return', from: 'Misclicked Feeder', to: 'Misclicked Main', date: '2026-08-04T12:00:00.000Z' }, { title: 'Left the family', type: 'roster_departure', from: 'Misclicked Feeder', to: 'Former member', date: '2026-06-22T12:00:00.000Z' }], mockMetrics: true },
  { tag: '#LJ8P0QY2R', name: 'Nova Bell', townHall: 15, trophies: 4250, clanName: 'Misclicked Academy', clanTag: '#YJ2P8Q0RC', active: true, joinedAt: '2025-11-16T12:00:00.000Z', leftAt: null, returnCount: 0, rushPercent: 19, labPurity: 82, threeStarRate: 74, warStars: 680, heroLevels: { king: 73, queen: 77, warden: 51, champion: 25 }, heroEquipment: [{ name: 'Giant Gauntlet', level: 21 }, { name: 'Rage Vial', level: 19 }, { name: 'Frozen Arrow', level: 18 }, { name: 'Eternal Tome', level: 17 }], mobilityTimeline: [{ title: 'Joined Misclicked Academy', type: 'roster_join', from: null, to: 'Misclicked Academy', date: '2025-11-16T12:00:00.000Z' }], mockMetrics: true },
];

export function RecruitmentPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event?: FormEvent<HTMLFormElement>, value = query) {
    event?.preventDefault();
    const normalized = value.trim().toUpperCase();
    if (!normalized) { setError('Enter a player or clan tag to search.'); return; }
    const tag = normalized.startsWith('#') ? normalized : `#${normalized}`;
    setQuery(tag); setBusy(true); setError(''); setResult(null);
    try {
      const response = await apiRequest<SearchReply>(`/api/public-search?q=${encodeURIComponent(tag)}`);
      setResult(response);
    } catch {
      const profiles = mockProfiles.filter((profile) => profile.tag === tag || profile.clanTag === tag);
      if (profiles.length) {
        const clan = profiles.find((profile) => profile.clanTag === tag);
        setResult({ kind: clan ? 'clan' : 'player', query: tag, clan: clan ? { name: clan.clanName, tag: clan.clanTag, clanLevel: 27, league: 'Champion II', trophies: 48620 } : undefined, items: profiles });
      } else {
        setError('Live search is unavailable. The local demo index only includes its sample tags.');
      }
    } finally { setBusy(false); }
  }

  return <main className="public-recruitment-page">
    <header className="public-recruitment-topbar"><Link to="/recruitment" className="public-brand"><span><Shield size={21} fill="currentColor"/></span><strong>MISCLICKED <b>FAMILY</b><small>PUBLIC RECRUITMENT INDEX</small></strong></Link><Link to="/login" className="public-leader-link">Leader sign in <ArrowRight size={15}/></Link></header>
    <div className="public-recruitment-content">
      <section className="public-recruitment-hero"><div className="public-recruitment-hero__spark">✦</div><span className="game-ribbon">OPEN TO ALL · NO ACCOUNT NEEDED</span><h1>Find the story<br/>behind the <em>tag.</em></h1><p>Scout a player or clan before your next invite. Get a clear look at village progress, war performance and family mobility.</p><div className="public-index-facts"><span><UsersRound size={15}/> 3 family clans</span><span><Trophy size={15}/> War performance</span><span><Shield size={15}/> Public player data</span></div></section>

      <Panel className="public-recruitment-search"><form onSubmit={(event) => void submit(event)}><label className="public-tag-input"><Tag size={20}/><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Search #PLAYERTAG or #CLANTAG" aria-label="Search public player or clan tag" autoComplete="off"/><kbd>↵</kbd></label><Button type="submit" leading={<Search size={16}/>} disabled={busy}>{busy ? 'Searching…' : 'Search'}</Button></form><div className="public-search-examples"><span>DEMO CLANS</span>{['#2Q0P2YLRG','#8Y2Q0P9LV','#YJ2P8Q0RC'].map((tag) => <button type="button" key={tag} onClick={() => { setQuery(tag); void submit(undefined, tag); }}>{tag}<ArrowRight size={11}/></button>)}</div>{error ? <p className="game-form-error" role="alert">{error}</p> : null}</Panel>

      {busy ? <Panel className="public-search-loading"><span className="spinner"/><div><strong>Checking the family index…</strong><small>Looking up player stats and clan mobility records.</small></div></Panel> : null}
      {!busy && result?.kind === 'clan' && result.clan ? <section className="public-clan-result"><Panel className="public-clan-banner"><span className="public-clan-banner__crest"><Shield size={27} fill="currentColor"/></span><div><span className="game-ribbon">CLAN PROFILE · {result.clan.tag}</span><h2>{result.clan.name}</h2><p>Level {result.clan.clanLevel} <i>·</i> {result.clan.league} <i>·</i> {result.clan.trophies.toLocaleString()} trophies</p></div><Badge tone="green">{result.items.length} BASES INDEXED</Badge></Panel><p className="public-result-intro">Member profiles in this clan. Choose any player card to inspect progression and clan history.</p>{result.items.length ? <div className="public-profile-grid">{result.items.map((profile) => <PublicProfileCard key={profile.tag} profile={profile}/>)}</div> : <Panel><EmptyState icon={<UsersRound size={21}/>} title="No public roster records" detail="This clan tag is recognized, but the public member index is empty."/></Panel>}</section> : null}
      {!busy && result?.kind === 'player' ? <section className="public-player-result"><div className="public-result-heading"><span className="game-ribbon">PLAYER SEARCH RESULTS</span><h2>{result.items.length} profile{result.items.length === 1 ? '' : 's'} found</h2></div><div className="public-profile-grid">{result.items.map((profile) => <PublicProfileCard key={profile.tag} profile={profile}/>)}</div></section> : null}
      {!busy && result?.kind === 'none' ? <Panel className="public-search-empty"><EmptyState icon={<Search size={22}/>} title="No matching player or clan" detail="Check the tag and try again. Search supports a player #PLAYERTAG or clan #CLANTAG." action={<Button variant="outline" onClick={() => { setQuery(''); setResult(null); }}>Try another tag</Button>}/></Panel> : null}

      {!busy && !result ? <section className="public-metric-grid"><article><span><Swords size={17}/></span><strong>War 3-star rate</strong><p>See recent three-star performance from saved war history.</p></article><article><span><FlaskConical size={17}/></span><strong>Lab purity</strong><p>Understand research progress alongside the Town Hall tier.</p></article><article><span><Award size={17}/></span><strong>Clan mobility</strong><p>Review join, leave, return and transfer milestones.</p></article></section> : null}
      <div className="public-recruitment-note"><span><ArrowLeft size={14}/><Link to="/login">Back to clan command</Link></span><span><ExternalLink size={13}/>Metrics are estimates in demo mode; no live Supercell API credentials are exposed to this page.</span></div>
    </div>
    <footer className="public-recruitment-footer"><span>© MISCLICKED FAMILY · RECRUITMENT TOOL</span><span>Player tags are public game identifiers. Phone numbers and private notes are never shown here.</span></footer>
  </main>;
}

function PublicProfileCard({ profile }: { profile: PublicProfile }) {
  return <article className="public-profile-card"><header className="public-profile-card__head"><Avatar name={profile.name} size="md"/><div><h3>{profile.name}</h3><span>{profile.tag} <i>·</i> TH{profile.townHall}</span></div><Badge tone={profile.active ? 'green' : 'muted'} dot>{profile.active ? 'ACTIVE' : 'FORMER'}</Badge></header><div className="public-profile-clan"><Shield size={13}/><strong>{profile.clanName}</strong><span>{profile.clanTag}</span></div><div className="public-profile-metrics"><div><strong>{profile.rushPercent}%</strong><span>RUSH ESTIMATE</span><ProgressBar value={profile.rushPercent} tone={profile.rushPercent < 15 ? 'green' : 'orange'}/></div><div><strong>{profile.labPurity}%</strong><span>LAB PURITY</span><ProgressBar value={profile.labPurity} tone={profile.labPurity > 80 ? 'green' : 'gold'}/></div><div><strong>{profile.threeStarRate}%</strong><span>WAR 3★ RATE</span><ProgressBar value={profile.threeStarRate} tone="blue"/></div></div><div className="public-profile-equipment"><strong>HERO EQUIPMENT</strong><div>{profile.heroEquipment.slice(0, 4).map((item) => <span key={item.name}><i>✦</i>{item.name}<b>Lv {item.level}</b></span>)}</div></div><details className="public-mobility-details"><summary><span><Award size={14}/> Clan mobility timeline</span><span>{profile.mobilityTimeline.length} updates</span></summary><div className="public-mobility-list">{profile.mobilityTimeline.length ? profile.mobilityTimeline.map((event, index) => <div key={`${event.date}-${index}`}><i className={event.type === 'roster_departure' ? 'is-departure' : ''}/><span><strong>{event.title}</strong><small>{event.from && event.to ? `${event.from} → ${event.to}` : event.to || event.from}</small></span><time>{longDate(event.date)}<small>{relativeTime(event.date)}</small></time></div>) : <p>Join date on record: {longDate(profile.joinedAt)}. No clan changes found.</p>}</div></details><footer><span><Trophy size={12}/>{profile.trophies.toLocaleString()} trophies</span><span>{profile.warStars.toLocaleString()} war stars</span><span>{profile.mockMetrics ? 'Demo estimate' : 'Game profile'}</span></footer></article>;
}
