import { useState } from 'react';
import { ArrowRight, ChevronDown, ClipboardCheck, Info, Search, Shield, ShieldCheck, Swords, Trophy, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, PageHeading, Panel, ProgressBar, SelectField, StatCard } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { Member } from '../types';
import { readinessScore, readinessTone } from './helpers';

export function ReadinessPage(){
  const {data,user,save}=useWorkspace();
  const [mode,setMode]=useState<'war'|'cwl'>('war');
  const [clanFilter,setClanFilter]=useState('all');
  const [filter,setFilter]=useState<'all'|'ready'|'review'|'optedout'>('all');
  const [search,setSearch]=useState('');
  if(!data||!user)return null;
  const roster=data.members.filter((member)=>member.isActive);
  const scored=roster.map((member)=>({member,...readinessScore(member,mode)}));
  const ready=scored.filter((item)=>item.ready);
  const optedOut=scored.filter((item)=>!item.optedIn);
  const average=roster.length?Math.round(roster.reduce((sum,member)=>sum+member.heroReadiness,0)/roster.length):0;
  const visible=scored.filter(({member,ready,optedIn})=>{
    const q=search.trim().toLowerCase();
    return (!q||member.name.toLowerCase().includes(q)||member.tag.toLowerCase().includes(q))&&(clanFilter==='all'||member.clanId===clanFilter)&&(filter==='all'||(filter==='ready'&&ready)||(filter==='review'&&!ready&&optedIn)||(filter==='optedout'&&!optedIn));
  }).sort((a,b)=>Number(b.ready)-Number(a.ready)||b.score-a.score);
  return <div className="page-stack readiness-page">
    <PageHeading eyebrow="Battle operations · lineup intelligence" title="War readiness" detail="A decision-support board for regular war and CWL availability. Leadership makes the final call." actions={<Link to="/app/wars" className="btn btn--outline">War room <ArrowRight size={15}/></Link>} />
    <div className="readiness-mode-tabs" role="tablist" aria-label="Select readiness view"><button className={mode==='war'?'mode-tab mode-tab--active':''} role="tab" aria-selected={mode==='war'} onClick={()=>setMode('war')}><Swords size={17}/><span><strong>Regular war</strong><small>Attack window reliability</small></span><b>{roster.filter((member)=>readinessScore(member,'war').ready).length} READY</b></button><button className={mode==='cwl'?'mode-tab mode-tab--active':''} role="tab" aria-selected={mode==='cwl'} onClick={()=>setMode('cwl')}><Trophy size={17}/><span><strong>Clan War League</strong><small>Season lineup consideration</small></span><b>{roster.filter((member)=>readinessScore(member,'cwl').ready).length} READY</b></button></div>
    <section className="stat-grid stat-grid--compact"><StatCard icon={<ShieldCheck size={18}/>} label="Ready for lineup" value={`${ready.length} / ${roster.length}`} hint={`${roster.length?Math.round(ready.length/roster.length*100):0}% of active roster`} tone="green"/><StatCard icon={<UserX size={18}/>} label="Opted out" value={optedOut.length} hint="Check availability before locking" tone="gold"/><StatCard icon={<Trophy size={18}/>} label="Average hero signal" value={`${average}%`} hint="Leadership readiness indicator" tone="blue"/><StatCard icon={<ClipboardCheck size={18}/>} label="Review queue" value={scored.length-ready.length} hint="Opted-in bases below threshold" tone="gold"/></section>
    <Panel className="readiness-board"><div className="readiness-board__toolbar"><div><span className="eyebrow">LINEUP CANDIDATES · {mode==='war'?'REGULAR WAR':'CWL'}</span><h2>Who’s ready to answer the call?</h2></div><div className="readiness-filters"><label className="inline-search"><Search size={15}/><input placeholder="Find a base or tag" value={search} onChange={(event)=>setSearch(event.target.value)}/></label><SelectField label="Clan" value={clanFilter} onChange={(event)=>setClanFilter(event.target.value)}><option value="all">All clans</option>{data.clans.map((clan)=><option key={clan.id} value={clan.id}>{clan.shortName||clan.name}</option>)}</SelectField></div></div>
      <div className="filter-tabs readiness-filter-tabs" role="tablist">{(['all','ready','review','optedout'] as const).map((item)=><button className={filter===item?'filter-tab filter-tab--active':'filter-tab'} key={item} role="tab" aria-selected={filter===item} onClick={()=>setFilter(item)}>{item==='all'?'All bases':item==='ready'?'Ready':item==='review'?'Needs review':'Opted out'}<b>{item==='all'?scored.length:item==='ready'?ready.length:item==='optedout'?optedOut.length:scored.length-ready.length-optedOut.length}</b></button>)}</div>
      {visible.length?<div className="table-scroller"><table className="data-table readiness-table"><thead><tr><th>Player</th><th>Clan</th><th>Town Hall</th><th>Hero signal</th><th>Attack history · 30d</th><th>{mode==='war'?'War':'CWL'} availability</th><th>Readiness score</th><th>Lineup</th></tr></thead><tbody>{visible.map(({member,score,ready,optedIn})=><ReadinessRow key={member.id} member={member} score={score} ready={ready} optedIn={optedIn} onToggle={async()=>{try{await save('members',member.id,{[mode==='war'?'warOptIn':'cwlOptIn']:!optedIn});}catch{}}} canToggle={user.role==='leader'||user.role==='co_leader'}/>)}</tbody></table></div>:<EmptyState icon={<ShieldCheck size={22}/>} title="No bases in this view" detail="Try another clan or readiness filter."/>}
      <div className="table-footer"><span>Readiness calculations refresh from the saved roster.</span><span><Shield size={13}/> Co-Leader+ can update opt-in status</span></div>
    </Panel>
    <Panel className="readiness-method"><div className="readiness-method__icon"><Info size={18}/></div><div><span className="eyebrow">HOW THE SIGNAL WORKS</span><h3>Use the score as a conversation starter, not an auto-selection.</h3><p>Hero progress (40%), recent attack reliability (40%), and recent war participation (20%) make up the base score. A player must opt in, meet the threshold, and have fewer than two missed attacks to be marked ready. CWL uses the higher threshold.</p></div><Link className="panel-link" to="/app/members">Edit roster data <ArrowRight size={14}/></Link></Panel>
  </div>;
}

function ReadinessRow({member,score,ready,optedIn,onToggle,canToggle}:{member:Member;score:number;ready:boolean;optedIn:boolean;onToggle:()=>void;canToggle:boolean}){
  return <tr><td><Link className="player-cell player-cell--link" to={`/app/members/${member.id}`}><span className="table-player-seal">{member.name.slice(0,1)}</span><span><strong>{member.name}</strong><small>{member.tag}</small></span></Link></td><td><span className="clan-cell"><strong>{member.clanName}</strong><small>{member.role.replace('_',' ')}</small></span></td><td><Badge tone="blue">TH {member.townHall}</Badge></td><td><span className="hero-signal-cell"><ProgressBar value={member.heroReadiness} tone={readinessTone(member.heroReadiness)}/><b>{member.heroReadiness}%</b></span></td><td><span className="attack-record"><b>{member.warAttacks30d}</b><small>used</small><i>·</i><b className={member.missedAttacks30d?'text-warning':''}>{member.missedAttacks30d}</b><small>missed</small></span></td><td><button type="button" className={`availability-toggle ${optedIn?'availability-toggle--on':'availability-toggle--off'}`} disabled={!canToggle} onClick={onToggle} aria-pressed={optedIn}><i/>{optedIn?'Available':'Opted out'}{canToggle?<ChevronDown size={13}/>:null}</button></td><td><span className="score-cell"><span><strong>{score}</strong><small>/100</small></span><ProgressBar value={score} tone={readinessTone(score)}/></span></td><td><Badge tone={ready?'green':optedIn?'orange':'muted'} dot>{ready?'READY':optedIn?'REVIEW':'OUT'}</Badge></td></tr>;
}
