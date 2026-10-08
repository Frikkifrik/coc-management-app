import { useState, type FormEvent, type ReactNode } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import { Button, Field, Modal, SelectField, TextAreaField, Toggle } from '../components/ui';
import type { AppRole, Clan, Member, Reward, RewardClaim, User, War } from '../types';
import { dateTimeInput, toIso } from './helpers';

function FormFooter({ onClose, busy, label = 'Save changes' }: { onClose: () => void; busy: boolean; label?: string }) {
  return <div className="form-actions"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy} leading={<Sparkles size={15} />}>{busy ? 'Saving…' : label}</Button></div>;
}

function ModalForm({ title, kicker, onClose, onSubmit, children, busy, submitLabel, size }: { title: string; kicker: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode; busy: boolean; submitLabel: string; size?: 'md' | 'lg' }) {
  return <Modal title={title} kicker={kicker} onClose={onClose} size={size}><form onSubmit={onSubmit}>{children}<FormFooter onClose={onClose} busy={busy} label={submitLabel} /></form></Modal>;
}

export function MemberEditor({ member, clans, userRole, onClose, onSave }: { member: Member | null; clans: Clan[]; userRole: AppRole; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    name: member?.name || '', tag: member?.tag || '', personId: member?.personId || '', accountType: member?.accountType || 'Main',
    clanId: member?.clanId || clans[0]?.id || '', role: member?.role || 'member' as AppRole,
    townHall: member?.townHall || 12, builderHall: member?.builderHall ?? 10, xpLevel: member?.xpLevel ?? 120,
    trophies: member?.trophies || 0, bestTrophies: member?.bestTrophies || member?.trophies || 0,
    builderBaseTrophies: member?.builderBaseTrophies ?? 0, builderBaseLeague: member?.builderBaseLeague || 'Unranked', warStars: member?.warStars ?? 0,
    league: member?.league || 'Unranked', rankedTier: member?.rankedTier || 'Unranked', rankedPoints: member?.rankedPoints || 0,
    rewardPoints: member?.rewardPoints || 0, heroReadiness: member?.heroReadiness || 50,
    warEntries90d: member?.warEntries90d ?? 0, warAttacks90d: member?.warAttacks90d ?? 0, warMissed90d: member?.warMissed90d ?? 0,
    averageStars90d: member?.averageStars90d ?? 0, averageDestruction90d: member?.averageDestruction90d ?? 0,
    missedAttacks30d: member?.missedAttacks30d || 0, warAttacks30d: member?.warAttacks30d || 0, donationRatio: member?.donationRatio || 1,
    warOptIn: member?.warOptIn ?? true, cwlOptIn: member?.cwlOptIn ?? true, baseLink: member?.baseLink || '', bio: member?.bio || '',
    joinedAt: member?.joinedAt?.slice(0,10) || new Date().toISOString().slice(0,10), isActive: member?.isActive ?? true,
    heroLevels: member?.heroLevels || { king: 55, queen: 55, warden: 30, champion: 15, prince: 30, duke: 1 },
  }));
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onSave({ ...form, tag: form.tag.startsWith('#') ? form.tag : `#${form.tag}` }); onClose(); }
    catch { /* optimistic data layer shows the server error and keeps the editor open */ }
    finally { setBusy(false); }
  }
  return <ModalForm title={member ? 'Edit player base' : 'Add player to roster'} kicker="CLAN ROSTER" onClose={onClose} onSubmit={submit} busy={busy} submitLabel={member ? 'Save player' : 'Add player'} size="lg">
    <div className="form-grid form-grid--two">
      <Field label="Base name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. EmberSaint" required maxLength={32} />
      <Field label="Player tag" value={form.tag} onChange={(e) => set('tag', e.target.value.toUpperCase())} placeholder="#2Q0P2YLRG" required maxLength={17} />
      <Field label="Person / account group ID" value={form.personId} onChange={(e) => set('personId', e.target.value)} placeholder="Optional · group related bases" maxLength={64} />
      <SelectField label="Account type" value={form.accountType} onChange={(e) => set('accountType', e.target.value)}>{['Main','Alt','Baby 1','Baby 2','Donator','Other'].map((type) => <option key={type}>{type}</option>)}</SelectField>
      <SelectField label="Clan assignment" value={form.clanId} onChange={(e) => set('clanId', e.target.value)} required>{clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</SelectField>
      <SelectField label="In-game clan rank" value={form.role} onChange={(e) => set('role', e.target.value as AppRole)}>
        {(['member','elder','co_leader','leader'] as AppRole[]).map((role) => <option key={role} value={role} disabled={role === 'leader' && userRole !== 'leader'}>{role === 'co_leader' ? 'Co-Leader' : role[0].toUpperCase() + role.slice(1)}</option>)}
      </SelectField>
      <Field label="Town Hall" type="number" min={1} max={18} value={form.townHall} onChange={(e) => set('townHall', Number(e.target.value))} />
      <Field label="Builder Hall" type="number" min={0} max={10} value={form.builderHall} onChange={(e) => set('builderHall', Number(e.target.value))} />
      <Field label="XP level" type="number" min={1} max={500} value={form.xpLevel} onChange={(e) => set('xpLevel', Number(e.target.value))} />
      <Field label="Home trophies" type="number" min={0} value={form.trophies} onChange={(e) => set('trophies', Number(e.target.value))} />
      <Field label="Best trophies" type="number" min={0} value={form.bestTrophies} onChange={(e) => set('bestTrophies', Number(e.target.value))} />
      <Field label="Builder Base trophies" type="number" min={0} value={form.builderBaseTrophies} onChange={(e) => set('builderBaseTrophies', Number(e.target.value))} />
      <Field label="Builder Base league" value={form.builderBaseLeague} onChange={(e) => set('builderBaseLeague', e.target.value)} placeholder="Platinum League I" />
      <Field label="War stars" type="number" min={0} value={form.warStars} onChange={(e) => set('warStars', Number(e.target.value))} />
      <Field label="Home village league" value={form.league} onChange={(e) => set('league', e.target.value)} placeholder="Titan I" />
      <SelectField label="Ranked tier" value={form.rankedTier} onChange={(e) => set('rankedTier', e.target.value)}>{['Unranked','Bronze','Silver','Gold','Crystal','Master','Champion','Legend'].map((tier) => <option key={tier}>{tier}</option>)}</SelectField>
      <Field label="Ranked points" type="number" min={0} value={form.rankedPoints} onChange={(e) => set('rankedPoints', Number(e.target.value))} />
      <Field label="Reward points" type="number" min={0} value={form.rewardPoints} onChange={(e) => set('rewardPoints', Number(e.target.value))} />
      <Field label="Hero readiness (%)" type="number" min={0} max={100} value={form.heroReadiness} onChange={(e) => set('heroReadiness', Number(e.target.value))} />
      <Field label="War entries · 90d" type="number" min={0} value={form.warEntries90d} onChange={(e) => set('warEntries90d', Number(e.target.value))} />
      <Field label="Attacks completed · 90d" type="number" min={0} value={form.warAttacks90d} onChange={(e) => set('warAttacks90d', Number(e.target.value))} />
      <Field label="Missed attacks · 90d" type="number" min={0} value={form.warMissed90d} onChange={(e) => set('warMissed90d', Number(e.target.value))} />
      <Field label="Average stars · 90d" type="number" min={0} max={6} step="0.01" value={form.averageStars90d} onChange={(e) => set('averageStars90d', Number(e.target.value))} />
      <Field label="Average destruction · 90d" type="number" min={0} max={100} step="0.1" value={form.averageDestruction90d} onChange={(e) => set('averageDestruction90d', Number(e.target.value))} />
      <Field label="Missed war attacks · 30d" type="number" min={0} value={form.missedAttacks30d} onChange={(e) => set('missedAttacks30d', Number(e.target.value))} />
      <Field label="War attacks · 30d" type="number" min={0} value={form.warAttacks30d} onChange={(e) => set('warAttacks30d', Number(e.target.value))} />
      <Field label="Donation ratio" type="number" min={0} step="0.1" value={form.donationRatio} onChange={(e) => set('donationRatio', Number(e.target.value))} />
      <Field label="Date joined family" type="date" value={form.joinedAt} onChange={(e) => set('joinedAt', e.target.value)} />
      <Field className="form-grid__wide" label="Player profile URL (optional)" value={form.baseLink} onChange={(e) => set('baseLink', e.target.value)} placeholder="https://link.clashofclans.com/…" />
      <TextAreaField className="form-grid__wide" label="Leadership note" value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={2} placeholder="Strengths, goals or a private note for leaders" />
    </div>
    <div className="toggle-pair"><Toggle label="Active roster" detail="Archived bases retain their progression and return count." checked={form.isActive} onChange={(value) => set('isActive', value)} /><Toggle label="War roster" detail="Include in regular war readiness." checked={form.warOptIn} onChange={(value) => set('warOptIn', value)} /><Toggle label="CWL consideration" detail="Available for this season's league roster." checked={form.cwlOptIn} onChange={(value) => set('cwlOptIn', value)} /></div>
  </ModalForm>;
}

export function ClanEditor({ clan, onClose, onSave }: { clan: Clan | null; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: clan?.name || '', tag: clan?.tag || '', shortName: clan?.shortName || '', clanLevel: clan?.clanLevel || 1, league: clan?.league || 'Unranked', trophies: clan?.trophies || 0, warWinStreak: clan?.warWinStreak || 0, description: clan?.description || '' });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSave({ ...form, tag: form.tag.startsWith('#') ? form.tag : `#${form.tag}` }); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title={clan ? 'Edit clan profile' : 'Add a clan'} kicker="FAMILY ROSTER" onClose={onClose} onSubmit={submit} busy={busy} submitLabel={clan ? 'Save clan' : 'Create clan'}>
    <div className="form-grid form-grid--two"><Field label="Clan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} placeholder="Ironclad Vanguard" /><Field label="Clan tag" value={form.tag.toUpperCase()} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} required placeholder="#2Q0P2YLRG" maxLength={17} /><Field label="Short label" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} maxLength={24} placeholder="IRONCLAD" /><Field label="Clan level" type="number" min={1} max={30} value={form.clanLevel} onChange={(e) => setForm({ ...form, clanLevel: Number(e.target.value) })} /><Field label="CWL league" value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} placeholder="Champion II" /><Field label="Clan trophies" type="number" min={0} value={form.trophies} onChange={(e) => setForm({ ...form, trophies: Number(e.target.value) })} /><Field label="War win streak" type="number" min={0} value={form.warWinStreak} onChange={(e) => setForm({ ...form, warWinStreak: Number(e.target.value) })} /><TextAreaField className="form-grid__wide" label="Clan charter" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What makes this clan different?" /></div>
  </ModalForm>;
}

export function WarEditor({ war, clans, onClose, onSave }: { war: War | null; clans: Clan[]; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ clanId: war?.clanId || clans[0]?.id || '', opponent: war?.opponent || '', opponentTag: war?.opponentTag || '', warType: war?.warType || 'regular', state: war?.state || 'preparation', startAt: dateTimeInput(war?.startAt), endAt: dateTimeInput(war?.endAt || new Date(Date.now() + 48 * 3600_000).toISOString()), result: war?.result || 'pending', stars: war?.stars || 0, opponentStars: war?.opponentStars || 0, destruction: war?.destruction || 0, opponentDestruction: war?.opponentDestruction || 0, warSize: war?.warSize || 15, attacksUsed: war?.attacksUsed || 0, notes: war?.notes || '' });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSave({ ...form, startAt: toIso(form.startAt), endAt: toIso(form.endAt) }); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title={war ? 'Edit war record' : 'Log a war'} kicker="WAR ROOM" onClose={onClose} onSubmit={submit} busy={busy} submitLabel={war ? 'Update war' : 'Create war record'} size="lg">
    <div className="form-grid form-grid--two"><SelectField label="Clan" value={form.clanId} onChange={(e) => setForm({ ...form, clanId: e.target.value })}>{clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</SelectField><Field label="Opponent clan" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required placeholder="Nightfall Empire" /><Field label="Opponent tag" value={form.opponentTag} onChange={(e) => setForm({ ...form, opponentTag: e.target.value.toUpperCase() })} placeholder="#2Q0P2YLRG" /><SelectField label="War type" value={form.warType} onChange={(e) => setForm({ ...form, warType: e.target.value as typeof form.warType })}><option value="regular">Regular war</option><option value="cwl">Clan War League</option><option value="friendly">Friendly war</option></SelectField><SelectField label="War state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as typeof form.state })}><option value="preparation">Preparation</option><option value="in_war">Battle day</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option></SelectField><SelectField label="Result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as typeof form.result })}><option value="pending">Pending</option><option value="win">Victory</option><option value="loss">Defeat</option><option value="draw">Draw</option></SelectField><Field label="War starts" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /><Field label="War ends" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /><Field label="War size" type="number" min={5} max={50} value={form.warSize} onChange={(e) => setForm({ ...form, warSize: Number(e.target.value) })} /><Field label="Attacks used" type="number" min={0} value={form.attacksUsed} onChange={(e) => setForm({ ...form, attacksUsed: Number(e.target.value) })} /><Field label="Stars · our clan" type="number" min={0} value={form.stars} onChange={(e) => setForm({ ...form, stars: Number(e.target.value) })} /><Field label="Stars · opponent" type="number" min={0} value={form.opponentStars} onChange={(e) => setForm({ ...form, opponentStars: Number(e.target.value) })} /><Field label="Destruction % · our clan" type="number" min={0} max={100} step="0.1" value={form.destruction} onChange={(e) => setForm({ ...form, destruction: Number(e.target.value) })} /><Field label="Destruction % · opponent" type="number" min={0} max={100} step="0.1" value={form.opponentDestruction} onChange={(e) => setForm({ ...form, opponentDestruction: Number(e.target.value) })} /><TextAreaField className="form-grid__wide" label="War-room note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Attack calls, lineup notes or battle review" /></div>
  </ModalForm>;
}

export function AlertEditor({ members, clans, onClose, onSave }: { members: Member[]; clans: Clan[]; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', details: '', category: 'war', severity: 'warning', clanId: clans[0]?.id || '', playerId: '' });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSave({ ...form, playerId: form.playerId || null }); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title="Create clan alert" kicker="ALERT DESK" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Publish alert">
    <div className="form-grid form-grid--two"><Field className="form-grid__wide" label="Alert title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="CWL lineup locks in 6 hours" /><TextAreaField className="form-grid__wide" label="What needs attention?" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required rows={3} maxLength={1000} placeholder="Give the leadership team the context and next step." /><SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['war','cwl','progression','roster','rewards','system'].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</SelectField><SelectField label="Severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></SelectField><SelectField label="Clan" value={form.clanId} onChange={(e) => setForm({ ...form, clanId: e.target.value })}><option value="">Family-wide</option>{clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</SelectField><SelectField label="Player (optional)" value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })}><option value="">No single player</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.tag}</option>)}</SelectField></div>
  </ModalForm>;
}

export function RewardEditor({ reward, onClose, onSave }: { reward: Reward | null; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: reward?.name || '', description: reward?.description || '', category: reward?.category || 'Seasonal', pointsCost: reward?.pointsCost || 100, inventory: reward?.inventory || 0, isActive: reward?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSave(form); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title={reward ? 'Edit reward' : 'Add a reward'} kicker="CLAN REWARDS" onClose={onClose} onSubmit={submit} busy={busy} submitLabel={reward ? 'Save reward' : 'Add reward'}><div className="form-grid form-grid--two"><Field label="Reward name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Training Potion Pack" /><Field label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Magic items" /><Field className="form-grid__wide" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does the player receive?" /><Field label="Points cost" type="number" min={0} value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })} /><Field label="Available stock" type="number" min={0} value={form.inventory} onChange={(e) => setForm({ ...form, inventory: Number(e.target.value) })} /></div><Toggle label="Available to claim" detail="Hide this reward from the member catalogue when switched off." checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} /></ModalForm>;
}

export function ProgressEditor({ members, onClose, onSave }: { members: Member[]; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ playerId: members[0]?.id || '', eventType: 'note', title: '', details: '', fromValue: '', toValue: '' });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSave({ ...form, playerId: form.playerId || null }); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title="Record a milestone" kicker="PLAYER PROGRESSION" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add to history"><div className="form-grid form-grid--two"><SelectField className="form-grid__wide" label="Player base" value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })}><option value="">Clan-wide event</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.tag}</option>)}</SelectField><SelectField label="Milestone type" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}><option value="note">Leadership note</option><option value="town_hall">Town Hall upgrade</option><option value="hero_upgrade">Hero upgrade</option><option value="ranked_promotion">Ranked promotion</option><option value="league_change">League change</option><option value="war_milestone">War milestone</option><option value="role_change">Role change</option><option value="clan_transfer">Clan transfer</option></SelectField><Field label="Milestone title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="Archer Queen reached a new level" /><Field label="Previous value (optional)" value={form.fromValue} onChange={(e) => setForm({ ...form, fromValue: e.target.value })} placeholder="Champion II" /><Field label="New value (optional)" value={form.toValue} onChange={(e) => setForm({ ...form, toValue: e.target.value })} placeholder="Champion I" /><TextAreaField className="form-grid__wide" label="Context" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3} placeholder="Add details for the player's history." /></div></ModalForm>;
}

export function UserEditor({ account, members, onClose, onSave }: { account: User | null; members: Member[]; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ displayName: account?.displayName || '', email: account?.email || '', role: account?.role || 'member' as AppRole, playerId: account?.playerId || '', password: '' });
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { const payload: Record<string, unknown> = { ...form, playerId: form.playerId || null }; if (!form.password) delete payload.password; await onSave(payload); onClose(); } catch {} finally { setBusy(false); } }
  return <ModalForm title={account ? 'Edit portal account' : 'Invite a portal account'} kicker="ACCESS & ROLES" onClose={onClose} onSubmit={submit} busy={busy} submitLabel={account ? 'Save access' : 'Create account'}><div className="form-grid form-grid--two"><Field label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required maxLength={80} /><Field label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><SelectField label="Portal permission" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>{(['leader','co_leader','elder','member'] as AppRole[]).map((role) => <option key={role} value={role}>{role === 'co_leader' ? 'Co-Leader' : role[0].toUpperCase() + role.slice(1)}</option>)}</SelectField><SelectField label="Link to player base" value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })}><option value="">Not linked</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.tag}</option>)}</SelectField><Field className="form-grid__wide" label={account ? 'Reset password (optional)' : 'Temporary password'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!account} minLength={12} autoComplete="new-password" hint="Use at least 12 characters. Share temporary access privately." /></div><p className="form-note"><Shield size={15} /> Portal permissions are separate from the in-game clan rank. A Member account never becomes a Leader account just because its base is promoted.</p></ModalForm>;
}

export function StatusTransition({ claim, onUpdate }: { claim: RewardClaim; onUpdate: (status: RewardClaim['status']) => void }) {
  return <div className="claim-actions">{claim.status === 'pending' ? <><Button size="sm" variant="subtle" onClick={() => onUpdate('rejected')}>Decline</Button><Button size="sm" onClick={() => onUpdate('approved')}>Approve</Button></> : claim.status === 'approved' ? <Button size="sm" onClick={() => onUpdate('fulfilled')}>Mark delivered</Button> : null}</div>;
}
