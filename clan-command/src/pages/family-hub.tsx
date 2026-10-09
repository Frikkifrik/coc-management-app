import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, CalendarDays, Check, ChevronRight, CircleUserRound, Clock3, Crown, Filter, History, Phone, Plus, Search, Shield, ShieldCheck, Swords, UserPlus, UsersRound, X } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Field, Modal, PageHeading, Panel, SelectField } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import { useOperations } from '../operations-context';
import type { Clan, Member } from '../types';
import { longDate, relativeTime } from './helpers';

const clanColors = ['main', 'feeder', 'academy'];
const clanLabels = ['Main', 'Feeder', 'Academy'];
const roleNames: Record<string, string> = { leader: 'Leader', co_leader: 'Co-Leader', elder: 'Elder', member: 'Member' };
const tagPattern = /^#?[0-9A-Z]{3,16}$/i;

type AltAccount = { tag: string; name: string; accountType: string };

export function FamilyHubPage() {
  const { user, data, save, notify } = useWorkspace();
  const operations = useOperations();
  const [clanFilter, setClanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'former'>('active');
  const [query, setQuery] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const visible = useMemo(() => (data?.members || []).filter((member) => {
    const search = query.trim().toLowerCase();
    const searchMatch = !search || [member.name, member.tag, member.clanName, member.accountType].some((value) => value?.toLowerCase().includes(search));
    return searchMatch && member.isActive === (statusFilter === 'active') && (clanFilter === 'all' || member.clanId === clanFilter);
  }), [data?.members, query, statusFilter, clanFilter]);
  if (!data || !user) return null;
  const workspaceData = data;
  const canManage = ['leader', 'co_leader'].includes(user.role);
  const liveWarCount = data.wars.filter((war) => war.state === 'in_war').length;
  const activeMembers = data.members.filter((member) => member.isActive);
  const personCount = new Set(activeMembers.map((member) => member.personId || member.id)).size;

  async function register(payload: { name: string; phone: string; mainTag: string; clanId: string; townHall: number; alts: AltAccount[] }) {
    const normalizedTags = [payload.mainTag, ...payload.alts.map((item) => item.tag)].map((tag) => (tag.startsWith('#') ? tag : `#${tag}`).toUpperCase());
    const duplicate = normalizedTags.find((tag, index) => normalizedTags.indexOf(tag) !== index || workspaceData.members.some((member) => member.tag.toUpperCase() === tag));
    if (duplicate) throw new Error(`${duplicate} already appears in the family roster.`);
    let personId: string;
    try { personId = crypto.randomUUID(); } catch { personId = `person-${Date.now()}`; }
    const joinedAt = new Date().toISOString();
    for (let index = 0; index < normalizedTags.length; index += 1) {
      const alt = payload.alts[index - 1];
      await save('members', null, {
        name: index === 0 ? payload.name.trim() : alt?.name.trim() || `${payload.name.trim()} ${alt?.accountType || 'Alt'}`,
        tag: normalizedTags[index], personId, accountType: index === 0 ? 'Main' : alt?.accountType || 'Alt',
        clanId: payload.clanId, townHall: payload.townHall, builderHall: 10, xpLevel: payload.townHall * 10,
        trophies: 0, bestTrophies: 0, heroReadiness: 72, warOptIn: true, cwlOptIn: true, joinedAt, isActive: true,
        heroLevels: { king: 45, queen: 45, warden: 20, champion: 10, prince: 15, duke: 1 },
      });
    }
    operations.setPhone(personId, payload.phone.trim());
    notify(`${normalizedTags.length} linked account${normalizedTags.length === 1 ? '' : 's'} registered under one family profile.`);
  }

  return <div className="page-stack game-page family-hub-page">
    <PageHeading eyebrow="Misclicked family · clan operations" title="Family Hub" detail="One roster, three banners. Keep every player profile and account history in sync." actions={<>{canManage ? <Button leading={<UserPlus size={16} />} onClick={() => setRegistrationOpen(true)}>Register member</Button> : null}<Badge tone={liveWarCount ? 'green' : 'gold'} dot>{liveWarCount ? `${liveWarCount} ACTIVE WAR${liveWarCount === 1 ? '' : 'S'}` : 'NO ACTIVE WARS'}</Badge></>} />

    <section className="game-family-overview" aria-label="Family overview">
      <div className="game-family-overview__crest"><div className="game-crest"><Shield size={34} fill="currentColor"/><Crown size={17}/></div><span className="game-family-overview__spark">✦</span></div>
      <div className="game-family-overview__copy"><span className="game-ribbon">THREE CLANS · ONE FAMILY</span><h2>Misclicked Family</h2><p>Every account has a place. Every member has a story.</p></div>
      <div className="game-family-overview__metrics"><div><strong>{personCount}</strong><span>FAMILY MEMBERS</span></div><i/><div><strong>{activeMembers.length}</strong><span>ACTIVE BASES</span></div><i/><div><strong>{liveWarCount || '—'}</strong><span>WARS LIVE</span></div></div>
    </section>

    <section className="game-clan-grid" aria-label="Three family clans">
      {data.clans.slice(0, 3).map((clan, index) => {
        const members = activeMembers.filter((member) => member.clanId === clan.id);
        const war = data.wars.find((item) => item.clanId === clan.id && (item.state === 'in_war' || item.state === 'preparation'));
        return <button className={`game-clan-tile game-clan-tile--${clanColors[index] || 'main'}`} key={clan.id} onClick={() => { setClanFilter(clan.id); document.getElementById('family-roster')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          <span className="game-clan-tile__crest"><Shield size={26} fill="currentColor"/><b>{index + 1}</b></span>
          <span className="game-clan-tile__main"><small>CLAN {index + 1} · LVL {clan.clanLevel}</small><strong>{clan.name}</strong><span>{clan.league} <i>·</i> {clan.trophies.toLocaleString()} trophies</span></span>
          <span className="game-clan-tile__members"><strong>{members.length}</strong><small>BASES</small></span>
          <span className="game-clan-tile__war">{war ? <><i className={war.state === 'in_war' ? 'is-live' : 'is-prep'}/>{war.state === 'in_war' ? 'IN WAR' : 'PREPARING'}</> : <><i/>PEACE</>}</span>
          <ChevronRight size={17} className="game-clan-tile__arrow"/>
        </button>;
      })}
    </section>

    <Panel className="game-roster-panel" id="family-roster">
      <div className="game-roster-heading"><div><span className="game-ribbon">THE MEMBER REGISTRY</span><h2>Meet the family <span>{visible.length}</span></h2></div><div className="game-roster-heading__actions">{canManage ? <Button size="sm" leading={<Plus size={15}/>} onClick={() => setRegistrationOpen(true)}>Add member</Button> : null}</div></div>
      <div className="game-roster-controls">
        <div className="game-segmented" role="tablist" aria-label="Filter roster by clan">
          <button role="tab" aria-selected={clanFilter === 'all'} className={clanFilter === 'all' ? 'is-active' : ''} onClick={() => setClanFilter('all')}>Family <b>{activeMembers.length}</b></button>
          {data.clans.slice(0, 3).map((clan, index) => <button role="tab" aria-selected={clanFilter === clan.id} className={clanFilter === clan.id ? 'is-active' : ''} key={clan.id} onClick={() => setClanFilter(clan.id)}>{clanLabels[index] || clan.shortName} <b>{activeMembers.filter((member) => member.clanId === clan.id).length}</b></button>)}
        </div>
        <div className="game-roster-tools"><label className="game-search-field"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or player tag" aria-label="Search family roster"/><kbd>/</kbd></label><div className="game-segmented game-segmented--compact" role="group" aria-label="Member history filter"><button className={statusFilter === 'active' ? 'is-active' : ''} onClick={() => setStatusFilter('active')}>Active</button><button className={statusFilter === 'former' ? 'is-active' : ''} onClick={() => setStatusFilter('former')}>Former</button></div></div>
      </div>
      {visible.length ? <div className="game-member-grid">{visible.map((member) => {
        const clanIndex = Math.max(0, data.clans.findIndex((clan) => clan.id === member.clanId));
        return <button key={member.id} className={`game-member-card ${!member.isActive ? 'game-member-card--former' : ''}`} onClick={() => setSelected(member)}>
          <Avatar name={member.name} size="md" className={`game-member-card__avatar game-member-card__avatar--${clanColors[clanIndex] || 'main'}`}/>
          <span className="game-member-card__identity"><strong>{member.name}</strong><small>{member.tag} <i>·</i> TH{member.townHall} <i>·</i> {roleNames[member.role] || 'Member'}</small></span>
          <Badge tone={member.isActive ? 'green' : 'muted'}>{member.isActive ? data.clans[clanIndex]?.shortName || 'ACTIVE' : 'FORMER'}</Badge>
          <span className="game-member-card__history"><span><CalendarDays size={12}/> Joined {longDate(member.joinedAt)}</span><span><Clock3 size={12}/> {member.isActive ? `Last seen ${relativeTime(member.lastActiveAt)}` : `Left ${member.leftAt ? longDate(member.leftAt) : 'date not recorded'}`}</span></span>
          <ChevronRight size={16} className="game-member-card__open"/>
        </button>;
      })}</div> : <EmptyState icon={<UsersRound size={22}/>} title={statusFilter === 'former' ? 'No former members in this view' : 'No members found'} detail="Try another clan tab or clear your search to see more of the family." action={query ? <Button variant="outline" size="sm" onClick={() => setQuery('')}>Clear search</Button> : undefined}/>}
      <div className="game-roster-footer"><span><ShieldCheck size={14}/> Join dates, returns and departures stay on each player timeline.</span><span><Filter size={13}/> Showing {visible.length} of {data.members.length} player accounts</span></div>
    </Panel>

    {registrationOpen && canManage ? <RegistrationModal clans={data.clans} defaultClan={clanFilter !== 'all' ? clanFilter : data.clans[0]?.id || ''} onClose={() => setRegistrationOpen(false)} onRegister={register}/> : null}
    {selected ? <MemberHistoryDrawer member={selected} clan={data.clans.find((clan) => clan.id === selected.clanId)} phone={user.role === 'leader' || user.role === 'co_leader' ? operations.contacts[selected.personId || ''] : undefined} history={data.history.filter((event) => event.playerId === selected.id)} onClose={() => setSelected(null)}/> : null}
  </div>;
}

function RegistrationModal({ clans, defaultClan, onClose, onRegister }: { clans: Clan[]; defaultClan: string; onClose: () => void; onRegister: (payload: { name: string; phone: string; mainTag: string; clanId: string; townHall: number; alts: AltAccount[] }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mainTag, setMainTag] = useState('');
  const [clanId, setClanId] = useState(defaultClan);
  const [townHall, setTownHall] = useState(16);
  const [alts, setAlts] = useState<AltAccount[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const tags = [mainTag, ...alts.map((alt) => alt.tag).filter(Boolean)];
    if (tags.some((tag) => !tagPattern.test(tag.trim()))) { setError('Enter a valid #PLAYER tag for the main account and every linked alt.'); return; }
    setBusy(true);
    try { await onRegister({ name, phone, mainTag: mainTag.trim(), clanId, townHall, alts: alts.filter((alt) => alt.tag.trim()) }); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The member could not be registered.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Register a family member" kicker="MEMBER REGISTRY" onClose={onClose} size="lg">
    <form className="game-form" onSubmit={submit}>
      <div className="game-form-callout"><span><CircleUserRound size={18}/></span><p>One person profile can hold a main village and all of their alt or baby bases.</p><Badge tone="gold">PRIVATE</Badge></div>
      <div className="form-grid form-grid--two"><Field label="Player / family name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ember Saint" maxLength={32} required/><Field label="Phone number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 010 0024" autoComplete="tel" required hint="Saved to this browser's private demo state only."/><Field label="Main #PLAYER tag" value={mainTag} onChange={(event) => setMainTag(event.target.value.toUpperCase())} placeholder="#2Q0P2YLRG" required maxLength={17}/><SelectField label="Home clan" value={clanId} onChange={(event) => setClanId(event.target.value)}>{clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</SelectField><Field label="Town Hall" type="number" min={1} max={18} value={townHall} onChange={(event) => setTownHall(Number(event.target.value))}/></div>
      <div className="game-form-subheading"><div><span className="game-ribbon">LINKED ACCOUNTS</span><p>Add any alt or baby tags under this human profile.</p></div><Button size="sm" variant="outline" leading={<Plus size={15}/>} onClick={() => setAlts((current) => [...current, { tag: '', name: '', accountType: current.some((alt) => alt.accountType === 'Baby 1') ? 'Baby 2' : 'Baby 1' }])}>Add Alt/Baby Tag</Button></div>
      {alts.map((alt, index) => <div className="game-alt-row" key={`alt-${index}`}><span className="game-alt-row__seal">{index + 1}</span><Field label={`${alt.accountType} player tag`} value={alt.tag} onChange={(event) => setAlts((current) => current.map((item, row) => row === index ? { ...item, tag: event.target.value.toUpperCase() } : item))} placeholder="#8Y2Q0P9LV" maxLength={17}/><Field label="In-game name (optional)" value={alt.name} onChange={(event) => setAlts((current) => current.map((item, row) => row === index ? { ...item, name: event.target.value } : item))} placeholder="Leave blank to use family name"/><SelectField label="Account type" value={alt.accountType} onChange={(event) => setAlts((current) => current.map((item, row) => row === index ? { ...item, accountType: event.target.value } : item))}><option>Alt</option><option>Baby 1</option><option>Baby 2</option><option>Alt 2</option></SelectField><button type="button" className="game-alt-row__remove" aria-label={`Remove linked account ${index + 1}`} onClick={() => setAlts((current) => current.filter((_, row) => row !== index))}><X size={15}/></button></div>)}
      {error ? <p className="game-form-error" role="alert">{error}</p> : null}
      <div className="form-actions"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy} leading={<Check size={15} />}>{busy ? 'Registering accounts…' : 'Add to family roster'}</Button></div>
    </form>
  </Modal>;
}

function MemberHistoryDrawer({ member, clan, phone, history, onClose }: { member: Member; clan?: Clan; phone?: string; history: Array<{ id: string; title: string; details: string; createdAt: string; fromValue: string | null; toValue: string | null }>; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const timeline = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="game-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="game-drawer" role="dialog" aria-modal="true" aria-label={`${member.name} family profile`}>
      <div className="game-drawer__top"><span className="game-ribbon">PLAYER DOSSIER</span><button className="game-icon-button" aria-label="Close profile" onClick={onClose}><X size={19}/></button></div>
      <div className="game-drawer__profile"><Avatar name={member.name} size="lg" className="game-drawer__avatar"/><div><h2>{member.name}</h2><span>{member.tag}</span><div className="game-drawer__badges"><Badge tone="gold">TH {member.townHall}</Badge><Badge tone={member.isActive ? 'green' : 'muted'}>{member.isActive ? 'ACTIVE MEMBER' : 'FORMER MEMBER'}</Badge></div></div></div>
      <div className="game-drawer__clan"><span className="game-drawer__shield"><Shield size={21} fill="currentColor"/></span><span><small>FAMILY BANNER</small><strong>{clan?.name || member.clanName}</strong><small>{roleNames[member.role] || 'Member'} · {member.accountType || 'Main'}</small></span><ChevronRight size={17}/></div>
      <div className="game-drawer__facts"><div><CalendarDays size={15}/><span>Joined family</span><b>{longDate(member.joinedAt)}</b></div><div><History size={15}/><span>{member.isActive ? 'Family status' : 'Left family'}</span><b>{member.isActive ? 'Active' : member.leftAt ? longDate(member.leftAt) : 'Date not recorded'}</b></div>{phone ? <div><Phone size={15}/><span>Contact</span><b>{phone}</b></div> : null}<div><Swords size={15}/><span>War record</span><b>{Math.round((member.averageStars90d || 0) * 10) / 10}★ avg · {member.warStars} stars</b></div></div>
      <div className="game-drawer__timeline"><div className="game-drawer__section-head"><h3>Member history</h3><span>{timeline.length} EVENTS</span></div>{timeline.length ? timeline.map((event) => <div className="game-history-event" key={event.id}><i/><span><strong>{event.title}</strong><small>{event.details || [event.fromValue, event.toValue].filter(Boolean).join(' → ')}</small><time>{longDate(event.createdAt)} · {relativeTime(event.createdAt)}</time></span><ArrowDown size={13}/></div>) : <div className="game-history-empty">Joined the family on {longDate(member.joinedAt)}. Future role, clan and progression changes appear here.</div>}</div>
      <Button variant="outline" className="game-drawer__close" onClick={onClose}>Close profile</Button>
    </aside>
  </div>;
}
