import { useState } from 'react';
import { Activity, AlertTriangle, Bell, Check, CheckCircle2, CircleHelp, Filter, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, IconButton, PageHeading, Panel, SelectField, StatCard } from '../components/ui';
import { useWorkspace } from '../workspace-context';
import type { AppRole, ClanAlert } from '../types';
import { relativeTime } from './helpers';
import { AlertEditor } from './modals';
import { ConfirmDelete } from './members';

const roleRank:Record<AppRole,number>={member:1,elder:2,co_leader:3,leader:4};
const alertColor:Record<ClanAlert['severity'],'red'|'orange'|'blue'>={critical:'red',warning:'orange',info:'blue'};
const alertIcon:Record<ClanAlert['category'],typeof Bell>={war:Activity,cwl:ShieldAlert,progression:CircleHelp,roster:Bell,rewards:Bell,system:AlertTriangle};
const categoryNames:Record<ClanAlert['category'],string>={war:'War room',cwl:'CWL',progression:'Progression',roster:'Roster',rewards:'Rewards',system:'System'};

export function AlertPage(){
  const {data,user,save,remove}=useWorkspace();
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('open');
  const [severity,setSeverity]=useState('all');
  const [creating,setCreating]=useState(false);
  const [deleting,setDeleting]=useState<ClanAlert|null>(null);
  if(!data||!user)return null;
  const canCreate=roleRank[user.role]>=roleRank.elder;
  const canDelete=roleRank[user.role]>=roleRank.co_leader;
  const open=data.alerts.filter((item)=>item.status==='open');
  const critical=open.filter((item)=>item.severity==='critical').length;
  const visible=data.alerts.filter((alert)=>{
    const q=search.trim().toLowerCase();
    return (!q||alert.title.toLowerCase().includes(q)||alert.details.toLowerCase().includes(q)||(alert.playerName||'').toLowerCase().includes(q)||(alert.clanName||'').toLowerCase().includes(q))&&(status==='all'||alert.status===status)&&(severity==='all'||alert.severity===severity);
  });
  async function setAlertStatus(alert:ClanAlert,next:ClanAlert['status']){try{await save('alerts',alert.id,{status:next});}catch{}}
  return <div className="page-stack alerts-page">
    <PageHeading eyebrow="Clan tools · signal desk" title="Clan alerts" detail="Triage time-sensitive war, CWL, roster and progression signals." actions={canCreate?<Button leading={<Plus size={15}/>} onClick={()=>setCreating(true)}>Create alert</Button>:null}/>
    <div className="stat-grid stat-grid--compact"><StatCard icon={<Bell size={18}/>} label="Open alerts" value={open.length} hint="Unresolved clan signals" tone="blue"/><StatCard icon={<AlertTriangle size={18}/>} label="Critical calls" value={critical} hint="Needs leadership attention" tone="red"/><StatCard icon={<CheckCircle2 size={18}/>} label="Acknowledged" value={data.alerts.filter((alert)=>alert.status==='acknowledged').length} hint="Owner assigned, still open" tone="gold"/><StatCard icon={<Activity size={18}/>} label="Resolved" value={data.alerts.filter((alert)=>alert.status==='resolved').length} hint="Kept in alert history" tone="green"/></div>
    <Panel className="alert-desk"><div className="alert-toolbar"><div><span className="eyebrow">ALERT DESK</span><h2>Signals across the family</h2></div><div className="alert-filters"><label className="inline-search"><Search size={15}/><input placeholder="Search alerts or players" value={search} onChange={(event)=>setSearch(event.target.value)}/></label><SelectField label="Status" value={status} onChange={(event)=>setStatus(event.target.value)}><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="all">All statuses</option></SelectField><SelectField label="Severity" value={severity} onChange={(event)=>setSeverity(event.target.value)}><option value="all">All levels</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></SelectField></div></div>
      {visible.length?<div className="alert-list">{visible.map((alert)=>{const Icon=alertIcon[alert.category];return <article className={`alert-card alert-card--${alert.severity} ${alert.status==='resolved'?'alert-card--resolved':''}`} key={alert.id}><span className={`alert-card__icon alert-card__icon--${alert.severity}`}><Icon size={18}/></span><div className="alert-card__body"><div className="alert-card__meta"><Badge tone={alertColor[alert.severity]} dot>{alert.severity}</Badge><span>{categoryNames[alert.category]}</span><i>·</i><time>{relativeTime(alert.createdAt)}</time></div><h3>{alert.title}</h3><p>{alert.details}</p><div className="alert-card__subjects">{alert.playerId?<Link to={`/app/members/${alert.playerId}`}><span>{alert.playerName?.slice(0,1)||'P'}</span>{alert.playerName} <small>{alert.playerTag}</small></Link>:null}{alert.clanName?<span className="alert-subject-clan">{alert.clanName}</span>:<span className="alert-subject-clan">Family-wide</span>}</div></div><div className="alert-card__actions"><Badge tone={alert.status==='resolved'?'green':alert.status==='acknowledged'?'blue':'orange'}>{alert.status}</Badge>{alert.status==='open'?<Button size="sm" variant="outline" onClick={()=>void setAlertStatus(alert,'acknowledged')}>Acknowledge</Button>:alert.status==='acknowledged'?<Button size="sm" onClick={()=>void setAlertStatus(alert,'resolved')} leading={<Check size={13}/>}>Resolve</Button>:<Button size="sm" variant="ghost" onClick={()=>void setAlertStatus(alert,'open')}>Reopen</Button>}{canDelete?<IconButton label="Delete alert" onClick={()=>setDeleting(alert)}><Trash2 size={14}/></IconButton>:null}</div></article>})}</div>:<EmptyState icon={<Bell size={22}/>} title="No alerts match" detail="Try another status, severity or search term." action={<Button variant="outline" onClick={()=>{setSearch('');setStatus('all');setSeverity('all');}}>Clear filters</Button>}/>}<div className="table-footer"><span>Resolved alerts remain visible in the history filter.</span><span><ShieldAlert size={13}/> Role-gated leadership actions</span></div>
    </Panel>
    <div className="alerts-footnote"><span><Filter size={14}/></span><p>Alerts are saved in this app's local database. Discord delivery only occurs after a Leader configures and tests a webhook.</p></div>
    {creating?<AlertEditor members={data.members} clans={data.clans} onClose={()=>setCreating(false)} onSave={(payload)=>save('alerts',null,payload)}/>:null}
    {deleting?<ConfirmDelete title="Delete this alert?" detail="This removes the alert from the family queue. Use Resolve instead if you want to retain the record." onClose={()=>setDeleting(null)} onConfirm={async()=>{try{await remove('alerts',deleting.id);setDeleting(null);}catch{}}}/>:null}
  </div>;
}
