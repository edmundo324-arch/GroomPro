"use client";
import {useEffect,useState,useRef} from 'react';
import {reconcileForm} from '../lib/form-hydration';
import {employeeFetch} from '../lib/employee-fetch';
import {CompensationRules,defaultCompensation} from '../lib/compensation-rules';
import './employee-compensation.css';
import {EmployeePayrollMethod} from './employee-payroll-method';
type Props={userId:string;initiallyOpen?:boolean};
type Values={enabled:boolean;rules:CompensationRules;hire:string;dates:string};
export function EmployeeCompensation({userId,initiallyOpen=false}:Props){return <CompensationForm key={userId} userId={userId} initiallyOpen={initiallyOpen}/>}
function CompensationForm({userId,initiallyOpen=false}:Props){
 const [open,setOpen]=useState(initiallyOpen),[conflict,setConflict]=useState(false);
 const [data,setData]=useState<any>(null),[rules,setRules]=useState<CompensationRules>(defaultCompensation),[enabled,setEnabled]=useState(false),[hire,setHire]=useState(''),[dates,setDates]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(initiallyOpen);
 const latest=useRef<Values>({enabled,rules,hire,dates}),incoming=useRef<Values|null>(null),attempted=useRef(false),requesting=useRef(false);
 latest.current={enabled,rules,hire,dates};
 function accept(values:Values){setEnabled(values.enabled);setRules(values.rules);setHire(values.hire);setDates(values.dates)}
 function apply(d:any,submitted:Values){const saved:Values={enabled:!!d.rules,rules:d.rules||defaultCompensation,hire:d.dateOfHire?.slice(0,10)||'',dates:(d.workedDates||[]).join(', ')};setData(d);incoming.current=saved;const merged=reconcileForm(submitted,latest.current,saved);accept(merged.values);setConflict(merged.conflict)}
 async function request(action:'VIEW'|'SAVE',approveQualification=false){
  if(requesting.current)return;
  if(action!=='VIEW'&&conflict){setMessage('Review the saved compensation and your edits below before saving.');return;}
  if(action!=='VIEW'&&!data){setMessage('Load the saved compensation before making changes.');return;}
  const submitted=latest.current;attempted.current=true;requesting.current=true;setOpen(true);setBusy(true);setMessage('');
  try{const response=await employeeFetch('/api/employees/compensation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,action,rules:submitted.enabled?submitted.rules:null,dateOfHire:submitted.hire,workedDates:submitted.dates.split(/[\s,]+/).filter(Boolean),approveQualification})});const result=await response.json().catch(()=>null);if(!response.ok||!result||!Object.prototype.hasOwnProperty.call(result,'rules')||!Array.isArray(result.workedDates))throw Error(result?.error||'Compensation could not be retrieved or saved. Please try again.');apply(result,submitted);if(action!=='VIEW')setMessage('Compensation saved. Closed tickets keep their original earnings.')}catch(e){setMessage((e as Error).message)}finally{requesting.current=false;setBusy(false)}
 }
 useEffect(()=>{if(initiallyOpen&&!attempted.current)void request('VIEW')},[initiallyOpen]);
 const locked=!data;
 return <section className="gp-compensation-panel" aria-label="Employee Pay and Commissions"><h3>Pay &amp; Commissions</h3>{!open?<button type="button" className="gp-btn" disabled={busy} onClick={()=>void request('VIEW')}>Manage Compensation</button>:<>
  <EmployeePayrollMethod userId={userId}/>
  <div className="gp-compensation-feedback" aria-live="polite"><span role="status">{busy?(data?'Saving Compensation...':'Loading Compensation...'):message}</span>{!data&&!busy&&<button type="button" className="gp-btn" onClick={()=>void request('VIEW')}>Retry Loading Compensation</button>}</div>
  {conflict&&<p className="gp-compensation-conflict" role="alert">The saved compensation differs from your edits. Review before saving. <button type="button" className="gp-btn" onClick={()=>setConflict(false)}>Keep My Edits</button><button type="button" className="gp-btn" onClick={()=>{if(incoming.current)accept(incoming.current);setConflict(false)}}>Use Saved Values</button></p>}
  <fieldset className="gp-compensation-content" disabled={locked}>
   <label className="gp-compensation-check gp-compensation-enable"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Use These Pay &amp; Commission Settings</label>
   <fieldset className="gp-compensation-basic" disabled={!enabled} aria-label="Base Pay and Tips">
    <label>Hourly Rate ($)<input type="number" min="0" step="0.01" value={rules.hourlyCents/100} onChange={e=>setRules({...rules,hourlyCents:Math.round(Number(e.target.value)*100)})}/></label>
    <label>Base Service Commission (%)<input type="number" min="0" max="100" value={rules.basePercent} onChange={e=>setRules({...rules,basePercent:Number(e.target.value)})}/></label>
    <label className="gp-compensation-check"><input type="checkbox" checked={rules.participatesInTips} onChange={e=>setRules({...rules,participatesInTips:e.target.checked})}/> Participates in Tips</label>
   </fieldset>
   <fieldset className="gp-compensation-section gp-compensation-work-history"><legend>Employment &amp; Worked Dates</legend>
    <div className="gp-compensation-dates"><label>Hire Date<input type="date" value={hire} onChange={e=>setHire(e.target.value)}/></label><label>Actual Worked Dates<textarea rows={2} placeholder="YYYY-MM-DD, separated by commas" value={dates} onChange={e=>setDates(e.target.value)}/></label></div>
    <p className="gp-compensation-help">Include days worked with no dogs. Completed grooming assignments count once per dog per day.</p>
    <p className="gp-compensation-metric">Last 30 Calendar Days ({data?.from||'-'} through {data?.through||'-'}): {data?.metric?.dogs??'-'} Dogs / {data?.metric?.workedDays??'-'} Worked Days = <strong>{data?.metric?.average?.toFixed(2)??'-'} Dogs/Day</strong></p>
   </fieldset>
   <fieldset className="gp-compensation-section gp-compensation-thresholds" disabled={!enabled}><legend>Commission Qualification Thresholds</legend><p className="gp-compensation-help">Set commission rates for an employee's average dogs per day and length of employment.</p>
    {rules.tiers.map((tier,i)=><div className="gp-compensation-threshold-row" key={i}><label>Minimum Dogs/Day<input type="number" min="0" step="0.1" value={tier.minimumAverage} onChange={e=>setRules({...rules,tiers:rules.tiers.map((t,n)=>n===i?{...t,minimumAverage:Number(e.target.value)}:t)})}/></label><label>Minimum Days Employed<input type="number" min="0" value={tier.minimumDaysEmployed} onChange={e=>setRules({...rules,tiers:rules.tiers.map((t,n)=>n===i?{...t,minimumDaysEmployed:Number(e.target.value)}:t)})}/></label><label>Commission (%)<input type="number" min="0" max="100" value={tier.percent} onChange={e=>setRules({...rules,tiers:rules.tiers.map((t,n)=>n===i?{...t,percent:Number(e.target.value)}:t)})}/></label><button type="button" className="gp-btn" onClick={()=>setRules({...rules,tiers:rules.tiers.filter((_,n)=>n!==i)})}>Remove Threshold</button></div>)}
    <button type="button" className="gp-btn" onClick={()=>setRules({...rules,tiers:[...rules.tiers,{minimumAverage:0,minimumDaysEmployed:0,percent:rules.basePercent}]})}>Add Threshold</button>
   </fieldset>
   <fieldset className="gp-compensation-section gp-compensation-earnings" disabled={!enabled}><legend>Service, Product, Package &amp; VIP Earnings</legend><p className="gp-compensation-help">Match a service code, category, or workflow role (PREP, BATH, GROOM), or use * for all items in that group. Specific matches take priority. Service exemptions still apply. VIP first-payment earnings require a verified first recurring payment.</p>
    {rules.rules.map((rule,i)=><div className="gp-compensation-rule-row" key={i}><label>Applies To<select value={rule.scope} onChange={e=>setRules({...rules,rules:rules.rules.map((r,n)=>n===i?{...r,scope:e.target.value as any}:r)})}><option value="SERVICE">Services</option><option value="PRODUCT">Merchandise</option><option value="PACKAGE">Packages</option><option value="VIP_FIRST_BILLING">VIP First Recurring Payment</option></select></label><label>Code / Category / Role<input value={rule.match} onChange={e=>setRules({...rules,rules:rules.rules.map((r,n)=>n===i?{...r,match:e.target.value}:r)})}/></label><label>Method<select value={rule.method} onChange={e=>setRules({...rules,rules:rules.rules.map((r,n)=>n===i?{...r,method:e.target.value as any,amount:0}:r)})}><option value="PERCENT">Percent</option><option value="PER_DOG">Dollars per Dog</option><option value="PER_UNIT">Dollars per Unit</option></select></label><label>{rule.method==='PERCENT'?'Percent':'Dollars'}<input type="number" min="0" step="0.01" value={rule.method==='PERCENT'?rule.amount:rule.amount/100} onChange={e=>setRules({...rules,rules:rules.rules.map((r,n)=>n===i?{...r,amount:rule.method==='PERCENT'?Number(e.target.value):Math.round(Number(e.target.value)*100)}:r)})}/></label><button type="button" className="gp-btn" onClick={()=>setRules({...rules,rules:rules.rules.filter((_,n)=>n!==i)})}>Remove Rule</button></div>)}
    <button type="button" className="gp-btn" onClick={()=>setRules({...rules,rules:[...rules.rules,{scope:'SERVICE',match:'*',method:'PERCENT',amount:0}]})}>Add Earnings Rule</button>
   </fieldset>
  </fieldset>
  {data?.qualification&&<p className="gp-compensation-qualification">Qualified Rate: <strong>{data.qualification.qualifiedPercent}%</strong>. Applied Rate: <strong>{data.qualification.appliedPercent}%</strong>. {data.qualification.approvalPending&&'Manager approval is pending.'}</p>}
  <div className="gp-compensation-actions"><button type="button" className="gp-btn primary" disabled={busy||locked||conflict} onClick={()=>void request('SAVE')}>Save Compensation</button>{data?.qualification?.approvalPending&&<button type="button" className="gp-btn" disabled={busy||locked||conflict} onClick={()=>void request('SAVE',true)}>Approve Qualified Rate</button>}<span>Closed tickets keep their original earnings.</span></div>
 </>}</section>;
}
