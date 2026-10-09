import { useState, useEffect } from 'react';
import { Activity, Crown, Flame, Plus, Shield, ShieldCheck, Trash2, Trophy, UsersRound, Waves, X } from 'lucide-react';
import { Badge, Button, IconButton, PageHeading, Panel, ProgressBar, StatCard } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { Clan } from '../types';
import { formatNumber } from './helpers';
import { ClanEditor } from './modals';
import { ConfirmDelete } from './members';
import { getClanByTag, type ClanData } from '../api';

export function ClanPage() {
  const { data, save, remove } = useWorkspace();
  const [editing, setEditing] = useState<Clan | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Clan | null>(null);
  const [viewingLive, setViewingLive] = useState<string | null>(null);

  // Store live data for all clans
  const [liveClans, setLiveClans] = useState<Record<string, ClanData>>({});

  // Fetch live Supercell data for all family clans on mount
  useEffect(() => {
    if (!data?.clans) return;

    const fetchLiveFamilyData = async () => {
      const results: Record<string, ClanData> = {};
      for (const clan of data.clans) {
        try {
          const liveData = await getClanByTag(clan.tag);
          // Only save to state if it's a valid clan object with a name
          if (liveData && liveData.name) {
            results[clan.tag] = liveData;
          }
        } catch (err) {
          console.error(`Failed to fetch live data for ${clan.tag}:`, err);
        }
      }
      setLiveClans(results);
    };

    fetchLiveFamilyData();
  }, [data?.clans]);

  if (!data) return null;

  const totalBases = data.members.filter((member) => member.isActive).length;
  
  // Calculate totals using LIVE data if available, fallback to local
  const familyTrophies = data.clans.reduce((sum, clan) => {
    const live = liveClans[clan.tag];
    return sum + (live ? live.clanPoints : clan.trophies);
  }, 0);

  const familyStreak = data.clans.reduce((sum, clan) => {
    const live = liveClans[clan.tag];
    return sum + (live ? live.warWinStreak : clan.warWinStreak);
  }, 0);

  const avgClanLevel = data.clans.length 
    ? (data.clans.reduce((sum, clan) => sum + (liveClans[clan.tag]?.clanLevel || clan.clanLevel), 0) / data.clans.length).toFixed(1) 
    : '0';

  return (
    <div className="page-stack">
      <PageHeading 
        eyebrow="Clan operations · family" 
        title="Your clans" 
        detail="A clear view of every banner, roster and league inside the family. Core stats are synced live from Supercell." 
        actions={<Button leading={<Plus size={16}/>} onClick={() => setEditing(null)}>Add clan</Button>} 
      />
      
      <section className="stat-grid stat-grid--compact">
        <StatCard icon={<ShieldCheck size={18}/>} label="Clan banners" value={data.clans.length} hint="Family network" tone="gold"/>
        <StatCard icon={<UsersRound size={18}/>} label="Active bases" value={totalBases} hint="Across all rosters" tone="blue"/>
        <StatCard icon={<Trophy size={18}/>} label="Family trophies" value={formatNumber(familyTrophies)} hint="Combined clan points" tone="green"/>
        <StatCard icon={<Flame size={18}/>} label="Total win streak" value={`${familyStreak} wars`} hint={`Average clan level ${avgClanLevel}`} tone="gold"/>
      </section>
      
      <div className="clan-card-grid">
        {data.clans.map((clan, index) => {
          const live = liveClans[clan.tag];
          
          // Use live data if loaded, otherwise fallback to local placeholders
          const displayName = live ? live.name : clan.name;
          const displayLevel = live ? live.clanLevel : clan.clanLevel;
          const displayDesc = live ? live.description : clan.description;
          const displayTrophies = live ? live.clanPoints : clan.trophies;
          const displayStreak = live ? live.warWinStreak : clan.warWinStreak;
          const displayType = live ? live.type.replace('inviteOnly', 'Invite Only').toUpperCase() : clan.shortName;

          const members = data.members.filter((member) => member.clanId === clan.id && member.isActive);
          const ready = members.filter((member) => member.warOptIn && member.heroReadiness >= 76 && member.missedAttacks30d < 2).length;
          const readyPct = members.length ? Math.round(ready / members.length * 100) : 0;
          const leaders = members.filter((member) => member.role === 'leader' || member.role === 'co_leader').slice(0, 3);
          
          return (
            <Panel className={`clan-management-card clan-management-card--${index}`} key={clan.id}>
              <div className="clan-management-card__top">
                <span className={`family-crest family-crest--${index}`}><Shield size={27} fill="currentColor"/></span>
                <div className="clan-management-card__tags">
                  <Badge tone="gold"><Crown size={12}/> CLAN LEVEL {displayLevel}</Badge>
                  <Badge tone={index === 0 ? 'gold' : index === 1 ? 'blue' : 'green'}>{clan.league}</Badge>
                </div>
                <div className="clan-card-menu">
                  <IconButton label={`Live Roster ${displayName}`} onClick={() => setViewingLive(clan.tag)}>
                    <Activity size={15}/>
                  </IconButton>
                  {/* The Pencil Edit button was removed here to prevent local overriding of live data */}
                  <IconButton label={`Remove ${displayName}`} onClick={() => setDeleting(clan)}>
                    <Trash2 size={15}/>
                  </IconButton>
                </div>
              </div>
              <div className="clan-management-card__identity">
                <span className="eyebrow">{displayType || 'CLAN'}</span>
                <h2>{displayName}</h2>
                <p className="line-clamp-2">{displayDesc || 'A banner within the clan family.'}</p>
                <span className="clan-tag">{clan.tag}</span>
              </div>
              <div className="clan-management-card__numbers">
                <div><strong>{live ? live.members : members.length}<small>/50</small></strong><span>ROSTER</span></div>
                <div><strong>{formatNumber(displayTrophies)}</strong><span>TROPHIES</span></div>
                <div><strong>{displayStreak}</strong><span>WIN STREAK</span></div>
              </div>
              <div className="clan-readiness">
                <div><span><ShieldCheck size={14}/> War readiness</span><b>{readyPct}%</b></div>
                <ProgressBar value={readyPct} tone={readyPct >= 78 ? 'green' : 'gold'} height="md"/>
                <small>{ready} opted-in bases meeting readiness criteria</small>
              </div>
              <div className="clan-management-card__leaders">
                <span>CLAN LEADERS (Local Roster)</span>
                <div>
                  {leaders.map((leader) => <span className="leader-chip" key={leader.id}><i>{leader.name.slice(0,1)}</i>{leader.name}<small>{leader.role === 'leader' ? 'L' : 'Co'}</small></span>)}
                  {leaders.length === 0 ? <small>Assign leadership in the roster</small> : null}
                </div>
              </div>
              <div className="clan-management-card__footer">
                <span><Waves size={14}/> {displayLevel >= 20 ? 'War progression' : 'Growth roster'}</span>
                <span>Last sync <b>{live ? 'Live' : 'Local'}</b></span>
              </div>
            </Panel>
          );
        })}
      </div>
      
      <Panel className="clan-health-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">FAMILY BALANCE</span><h2>Roster distribution</h2></div>
          <Badge tone="green" dot>HEALTHY</Badge>
        </div>
        <div className="clan-distribution">
          {data.clans.map((clan, index) => {
            const count = data.members.filter((member) => member.clanId === clan.id && member.isActive).length;
            const share = totalBases ? Math.round(count / totalBases * 100) : 0;
            const liveName = liveClans[clan.tag]?.name || clan.name;
            return (
              <div className="distribution-row" key={clan.id}>
                <span className={`mini-clan-crest mini-clan-crest--${index}`}><Shield size={15}/></span>
                <span><strong>{liveName}</strong><small>{count} active bases</small></span>
                <ProgressBar value={share} tone={index === 0 ? 'gold' : index === 1 ? 'blue' : 'green'}/>
                <b>{share}%</b>
                <span className="distribution-capacity">{Math.max(0, 50 - count)} open</span>
              </div>
            );
          })}
        </div>
        <div className="family-capacity">
          <span><UsersRound size={14}/> Family roster utilization</span>
          <ProgressBar value={Math.min(100, totalBases / 150 * 100)} tone="gold"/>
          <b>{totalBases} / 150 bases</b>
        </div>
      </Panel>
      
      {/* ClanEditor is only used now for creating NEW clans, not editing existing ones */}
      {editing !== undefined ? <ClanEditor clan={editing} onClose={() => setEditing(undefined)} onSave={(payload) => save('clans', editing?.id || null, payload)}/> : null}
      {deleting ? <ConfirmDelete title={`Remove ${deleting.name}?`} detail="A clan with players or war history cannot be deleted. Move the roster and archive war records first." onClose={() => setDeleting(null)} onConfirm={async () => { try { await remove('clans', deleting.id); setDeleting(null); } catch {} }}/> : null}
      
      {viewingLive ? <LiveClanRosterModal tag={viewingLive} onClose={() => setViewingLive(null)} /> : null}
    </div>
  );
}

// --- BULLETPROOF MODAL COMPONENT ---

function LiveClanRosterModal({ tag, onClose }: { tag: string, onClose: () => void }) {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getClanByTag(tag)
      .then((data) => {
        // Crash Prevention: If data is missing or doesn't have a memberList, throw an error safely
        if (!data || !data.memberList) {
          throw new Error((data as any)?.message || 'Clan not found or invalid data received.');
        }
        setClan(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tag]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
      <Panel className="clan-live-roster" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Live Supercell Roster</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>

        {loading && <p>Connecting to Supercell API...</p>}
        
        {/* Safely render error message without crashing */}
        {error && <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>Error: {error}</div>}

        {clan && !error && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              {clan.badgeUrls?.small && <img src={clan.badgeUrls.small} alt="Badge" style={{ width: 64, height: 64 }} />}
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{clan.name} <span style={{ color: '#666', fontWeight: 'normal' }}>({clan.tag})</span></h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#555', marginTop: '0.25rem' }}>
                  <span>Level: {clan.clanLevel}</span>
                  <span>Points: {clan.clanPoints}</span>
                  <span>Win Streak: {clan.warWinStreak}</span>
                  <span>Members: {clan.members}/50</span>
                </div>
              </div>
            </div>

            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '0.5rem' }}>#</th>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>Trophies</th>
                  <th style={{ padding: '0.5rem' }}>Donations (Give/Recv)</th>
                  <th style={{ padding: '0.5rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {clan.memberList.map((m) => (
                  <tr key={m.tag} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{m.clanRank}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{m.name}</td>
                    <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{m.role.replace('coLeader', 'Co-Leader')}</td>
                    <td style={{ padding: '0.5rem' }}>{m.trophies}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ color: 'green' }}>{m.donations}</span> / <span style={{ color: 'red' }}>{m.donationsReceived}</span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <a href={`/finder?tag=${encodeURIComponent(m.tag)}`} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}>
                        Inspect Player
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}