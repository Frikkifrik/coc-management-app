import { useState } from 'react';
import { ArrowRight, CalendarClock, CircleDot, Clock3, Pencil, Plus, Shield, Swords, Target, Trash2, Trophy } from 'lucide-react';
import { Badge, Button, EmptyState, PageHeading, Panel, ProgressBar, StatCard } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { War } from '../types';
import { shortDate, shortTime, warStatusLabel } from './helpers';
import { WarEditor } from './modals';
import { ConfirmDelete } from './members';

const stateTone = { preparation:'gold',in_war:'green',complete:'blue',cancelled:'muted' } as const;

export function WarsPage() {
  const { data, save, remove } = useWorkspace();
  const [editing,setEditing] = useState<War|null|undefined>(undefined);
  const [deleting,setDeleting] = useState<War|null>(null);
  const [filter,setFilter] = useState<'all'|'active'|'history'>('all');
  if(!data)return null;
  const active=data.wars.filter((war)=>war.state==='in_war');
  const prep=data.wars.filter((war)=>war.state==='preparation');
  const complete=data.wars.filter((war)=>war.state==='complete');
  const wins=complete.filter((war)=>war.result==='win').length;
  const winRate=complete.length?Math.round(wins/complete.length*100):0;
  const shown=data.wars.filter((war)=>filter==='all'||(filter==='active'&&(war.state==='in_war'||war.state==='preparation'))||(filter==='history'&&war.state==='complete'));
  return <div className="page-stack">
    <PageHeading eyebrow="Clan operations · battle desk" title="War room" detail="Current matchups, battle logs and clan-versus-clan history." actions={<Button leading={<Plus size={16}/>} onClick={()=>setEditing(null)}>Log a war</Button>} />
    <div className="stat-grid stat-grid--compact"><StatCard icon={<Swords size={18}/>} label="Live battles" value={active.length} hint={active.length?'Attack window is open':'No battle-day wars'} tone="green"/><StatCard icon={<CalendarClock size={18}/>} label="In preparation" value={prep.length} hint="Next lineups being built" tone="gold"/><StatCard icon={<Trophy size={18}/>} label="Recent win rate" value={`${winRate}%`} hint={`${wins} wins from ${complete.length} completed`} tone="blue"/><StatCard icon={<Target size={18}/>} label="Completed wars" value={complete.length} hint="Regular, friendly & CWL" tone="gold"/></div>
    {active.length? <div className="active-war-grid">{active.map(war=><ActiveWarCard war={war} key={war.id}/>)}</div>:null}
    <Panel className="war-history-panel"><div className="roster-toolbar"><div className="roster-toolbar__title"><div><span className="eyebrow">FAMILY WAR LOG</span><h2>{shown.length} matchup records</h2></div><Badge tone={active.length?'green':'muted'} dot>{active.length?'BATTLE DAY LIVE':'NO ACTIVE BATTLES'}</Badge></div><div className="filter-tabs" role="tablist" aria-label="Filter war records">{(['all','active','history'] as const).map((item)=><button key={item} role="tab" aria-selected={filter===item} className={filter===item?'filter-tab filter-tab--active':'filter-tab'} onClick={()=>setFilter(item)}>{item==='all'?'All wars':item==='active'?'Active': 'History'}<b>{item==='all'?data.wars.length:item==='active'?active.length+prep.length:complete.length}</b></button>)}</div></div>
      {shown.length?<div className="table-scroller"><table className="data-table war-table"><thead><tr><th>Matchup</th><th>Clan</th><th>Format</th><th>War state</th><th>Score</th><th>Destruction</th><th>Battle window</th><th/></tr></thead><tbody>{shown.map((war)=><tr key={war.id}><td><span className="war-opponent"><span className="opponent-crest"><Shield size={17}/></span><span><strong>{war.opponent}</strong><small>{war.opponentTag}</small></span></span></td><td><span className="clan-cell"><strong>{war.clanName}</strong><small>{war.warSize} vs {war.warSize}</small></span></td><td><Badge tone={war.warType==='cwl'?'gold':war.warType==='friendly'?'blue':'muted'}>{war.warType==='cwl'?'CWL':war.warType==='regular'?'Regular':'Friendly'}</Badge></td><td><Badge tone={stateTone[war.state]} dot>{warStatusLabel(war)}</Badge></td><td><strong className="war-table-score">{war.stars}<small> : </small>{war.opponentStars}</strong></td><td><span className="destruction-cell"><ProgressBar value={war.destruction} tone={war.destruction>=90?'green':'gold'}/><b>{war.destruction.toFixed(1)}%</b></span></td><td><span className="clan-cell"><strong>{shortDate(war.startAt)} · {shortTime(war.startAt)}</strong><small>Ends {shortDate(war.endAt)} · {shortTime(war.endAt)}</small></span></td><td><div className="row-actions"><button className="table-icon-action" title="Edit war" aria-label="Edit war" onClick={()=>setEditing(war)}><Pencil size={14}/></button><button className="table-icon-action" title="Delete war" aria-label="Delete war" onClick={()=>setDeleting(war)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>:<EmptyState icon={<Swords size={22}/>} title="No wars in this view" detail="Create a war record to start building your clan's battle history." action={<Button onClick={()=>setEditing(null)} leading={<Plus size={15}/>}>Log a war</Button>}/>}<div className="table-footer"><span>War results stay in this clan database.</span><span><CircleDot size={12}/> Updated just now</span></div>
    </Panel>
    <Panel className="war-room-note"><span><Clock3 size={17}/></span><div><strong>Readiness is a signal, not a guarantee.</strong><p>Use hero progress, opt-in status, attendance and leadership judgement together before setting a lineup.</p></div><a href="/app/readiness" className="panel-link">Check readiness <ArrowRight size={14}/></a></Panel>
    {editing!==undefined?<WarEditor war={editing} clans={data.clans} onClose={()=>setEditing(undefined)} onSave={(payload)=>save('wars',editing?.id||null,payload)}/>:null}
    {deleting?<ConfirmDelete title="Delete this war record?" detail="Its participation and battle history will be removed from the local database." onClose={()=>setDeleting(null)} onConfirm={async()=>{try{await remove('wars',deleting.id);setDeleting(null);}catch{}}}/>:null}
  </div>;
}

function ActiveWarCard({war}:{war:War}){
  const remaining=Math.max(0,Math.ceil((new Date(war.endAt).getTime()-Date.now())/3_600_000));
  return <Panel className="active-war-card"><div className="active-war-card__head"><span className="eyebrow">{war.clanName} · {war.warType==='cwl'?'CWL':'REGULAR WAR'}</span><Badge tone="green" dot>IN BATTLE</Badge></div><div className="active-war-card__match"><div className="war-team-mini"><span className="mini-shield"><Shield size={21}/></span><strong>{war.clanName}</strong><small>OUR CLAN</small></div><div className="active-war-score"><strong>{war.stars}</strong><span>:</span><strong>{war.opponentStars}</strong></div><div className="war-team-mini"><span className="mini-shield mini-shield--opponent"><Shield size={21}/></span><strong>{war.opponent}</strong><small>OPPONENT</small></div></div><div className="active-war-card__stats"><div><span>Attacks used</span><b>{war.attacksUsed}<small> / {war.warSize*2}</small></b></div><div><span>Destruction</span><b>{war.destruction.toFixed(1)}%</b></div><div><span>Time left</span><b>{remaining}h</b></div></div><ProgressBar value={war.destruction} tone="gold" height="md"/><div className="active-war-card__footer"><span>Last updated <b>just now</b></span><span>Live from clan record</span></div></Panel>;
}
