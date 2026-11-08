"use client";
import {useEffect,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {coverageRanges,type CoverageRange} from '../lib/calendar-coverage';
import {DismissButton} from './dismiss-button';

type Proposal={ticketId:string;petId:string;packageKey?:string;pet:string;type:string;start:string;employeeId:string;employee:string;reason?:string};
export function CalendarCoverage({date,employeeId,ranges,onClose,onApplied}:{date:string;employeeId?:string;ranges:CoverageRange[];onClose:()=>void;onApplied:(count:number)=>void}){
 const [range,setRange]=useState<CoverageRange>(employeeId?'day':ranges[0]||'day');
 const [plan,setPlan]=useState<{proposals:Proposal[];timezone:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setPlan(null);setError('');setBusy(true);
  employeeFetch('/api/calendar/coverage',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({date,employeeId,range})})
   .then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(!controller.signal.aborted)setPlan(result)})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message)})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[date,employeeId,range,revision]);
 async function apply(){
  if(!plan||busy)return;
  setBusy(true);setError('');
  try{
   const response=await employeeFetch('/api/calendar/coverage',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,employeeId,range,proposals:plan.proposals.filter(p=>p.employeeId)})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   for(const ticketId of result.ticketIds)window.dispatchEvent(new CustomEvent('groompro:ticket-changed',{detail:{ticketId}}));
   onApplied(result.assigned);
  }catch(e){setError((e as Error).message);setPlan(null)}finally{setBusy(false)}
 }
 const count=plan?.proposals.filter(p=>p.employeeId).length||0;
 return <section className="gp-floating-window gp-coverage-review" role="dialog" aria-label={employeeId?'Find Coverage':'Assign Unassigned'}>
  <header className="gp-pos-picker-title"><h2>{employeeId?'Find Coverage':'Assign Unassigned'}</h2><DismissButton label="Dismiss coverage review" disabled={busy} onClick={onClose}/></header>
  {!employeeId&&<label>Range <select value={range} onChange={e=>setRange(e.target.value as CoverageRange)} disabled={busy}>{ranges.map(key=><option key={key} value={key}>{coverageRanges[key]}</option>)}</select></label>}
  {busy&&<p role="status">Checking coverage…</p>}
  {error&&<p role="alert">{error} <button type="button" className="gp-btn" onClick={()=>setRevision(v=>v+1)}>Review again</button></p>}
  {plan&&<><p>{plan.proposals.length?count+' ready to assign · '+(plan.proposals.length-count)+' need review':'No unassigned appointments in this range.'}</p>
   <ul>{plan.proposals.map(p=><li key={p.ticketId+':'+p.petId+':'+(p.packageKey||'')}><strong>{p.pet}</strong>{p.type?' · '+p.type:''} · {new Date(p.start).toLocaleString(undefined,{timeZone:plan.timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · {p.employee||p.reason}</li>)}</ul>
   <button type="button" className="gp-btn primary" disabled={!count||busy} onClick={()=>void apply()}>Apply {count} {count===1?'assignment':'assignments'}</button>
  </>}
 </section>;
}
