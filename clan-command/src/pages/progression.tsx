import { useState } from 'react';
import { ArrowRight, CalendarClock, Filter, History, Plus, Sparkles, Trophy, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, PageHeading, Panel } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { AppRole } from '../types';
import { ProgressEditor } from './modals';
import { relativeTime, shortDate } from './helpers';

const roleRank:Record<AppRole,number>={member:1,elder:2,co_leader:3,leader:4};
const typeIcons:Record<string,string>={town_hall:'🏰',hero_upgrade:'⚒',ranked_promotion:'🏆',league_change:'🌟',war_milestone:'⚔',role_change:'🛡',clan_transfer:'🚩',note:'✦',roster_join:'✚'};
const typeLabels:Record<string,string>={town_hall:'Town Hall',hero_upgrade:'Hero upgrade',ranked_promotion:'Ranked promotion',league_change:'League movement',war_milestone:'War milestone',role_change:'Role update',clan_transfer:'Clan move',note:'Leadership note',roster_join:'Roster join'};

export function HistoryPage(){
  const {user,data,addHistory}=useWorkspace();
  const [kind,setKind]=useState('all');
  const [period,setPeriod]=useState('all');
  const [showEditor,setShowEditor]=useState(false);
  if(!user||!data)return null;
  const canAdd=roleRank[user.role]>=roleRank.elder;
  const now=Date.now();
  const events=data.history.filter((event)=>{
    const matchesKind=kind==='all'||event.eventType===kind;
    const age=now-new Date(event.createdAt).getTime();
    const matchesPeriod=period==='all'||(period==='7d'&&age<7*86400000)||(period==='30d'&&age<30*86400000);
    return matchesKind&&matchesPeriod;
  });
  const kinds=Array.from(new Set(data.history.map((event)=>event.eventType)));
  const upgrades=data.history.filter((event)=>event.eventType==='town_hall'||event.eventType==='hero_upgrade').length;
  const ranked=data.history.filter((event)=>event.eventType==='ranked_promotion'||event.eventType==='league_change').length;
  return <div className="page-stack progression-page">
    <PageHeading eyebrow="Growth & recognition · family timeline" title="Progression" detail="Town Hall growth, ranked climbs, war milestones and the people behind them." actions={<>{canAdd?<Button leading={<Plus size={15}/>} onClick={()=>setShowEditor(true)}>Record milestone</Button>:null}<Link to="/app/ranked" className="btn btn--outline">Ranked overview <ArrowRight size={15}/></Link></>} />
    <div className="progression-overview"><div className="progression-overview__main"><span className="eyebrow">THE FAMILY IS GROWING</span><strong>{data.history.length}<small> events</small></strong><p>Every milestone is a step forward for a base and a banner.</p><div className="progression-overview__stats"><span><TrendingUp size={14}/>{upgrades} village upgrades</span><span><Trophy size={14}/>{ranked} league moves</span><span><History size={14}/>{data.history.length} timeline events</span></div></div><div className="progression-sparks" aria-hidden="true">{[31,55,42,78,60,89,68,96,53,73,46,85,63,100,76,58,91,66].map((height,index)=><i key={index} className={index>12?'progression-sparks__bar progression-sparks__bar--bright':'progression-sparks__bar'} style={{height:`${height}%`}}/>)}</div><div className="progression-overview__badge"><span><Sparkles size={20}/></span><strong>Small wins<br/>stack into legends.</strong></div></div>
    <Panel className="timeline-panel"><div className="timeline-toolbar"><div><span className="eyebrow">PLAYER HISTORY</span><h2>Family timeline <small>· {events.length} events</small></h2></div><div className="timeline-filters"><label><Filter size={13}/><select aria-label="Filter by milestone" value={kind} onChange={(event)=>setKind(event.target.value)}><option value="all">All milestones</option>{kinds.map((item)=><option key={item} value={item}>{typeLabels[item]||item}</option>)}</select></label><label><CalendarClock size={13}/><select aria-label="Filter timeline period" value={period} onChange={(event)=>setPeriod(event.target.value)}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label></div></div>
      {events.length?<div className="family-timeline">{events.map((event,index)=><article className="timeline-card" key={event.id}><div className="timeline-card__rail"><span className={`timeline-card__icon timeline-card__icon--${event.eventType}`}>{typeIcons[event.eventType]||'✦'}</span>{index<events.length-1?<i/>:null}</div><div className="timeline-card__body"><div className="timeline-card__top"><span className="timeline-card__type">{typeLabels[event.eventType]||event.eventType}</span><time>{relativeTime(event.createdAt)} <i>·</i> {shortDate(event.createdAt,{year:'numeric'})}</time></div><h3>{event.title}</h3><p>{event.details||'A new milestone was recorded in the clan family.'}</p><div className="timeline-card__meta"><Link to={event.playerId?`/app/members/${event.playerId}`:'/app/dashboard'} className="timeline-person"><span>{event.playerName.slice(0,1)}</span><strong>{event.playerName}</strong></Link>{event.playerTag?<span className="timeline-tag">{event.playerTag}</span>:null}{event.clanName?<Badge tone="muted">{event.clanName}</Badge>:null}{event.fromValue&&event.toValue?<span className="timeline-transition">{event.fromValue}<ArrowRight size={12}/><b>{event.toValue}</b></span>:null}</div></div></article>)}</div>:<EmptyState icon={<History size={22}/>} title="No milestones in this window" detail="Change the filters or record a new achievement to get the timeline started." action={canAdd?<Button onClick={()=>setShowEditor(true)} leading={<Plus size={15}/>}>Record milestone</Button>:null}/>}<div className="table-footer"><span>Progression logs preserve the original moment and player tag.</span><span>Most recent first</span></div>
    </Panel>
    <div className="history-data-note"><span><Sparkles size={15}/></span><p>Player progression may be entered by leadership or imported during an authorized game-data sync. Clan Command never reads your Google Drive or Sheets.</p></div>
    {showEditor?<ProgressEditor members={data.members} onClose={()=>setShowEditor(false)} onSave={addHistory}/>:null}
  </div>;
}
