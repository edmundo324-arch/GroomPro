"use client";

import {helpfulError} from '../lib/human-communication';
import './custom-rule-settings.css';

import {useEffect,useState} from 'react';

import {FloatingEditorWindow} from './floating-editor-window';

import {HelpPopup} from './help-popup';

import {employeeFetch} from '../lib/employee-fetch';

import {customRuleEvents,customRuleVariables,CustomRuleDraft,CustomRuleAction,executableStaffEvents,executableMessageEvents} from '../lib/custom-rule-policy';

type Choice={id:string;name:string};

type SavedRule=CustomRuleDraft&{state:'DRAFT'|'ACTIVE'};

const blank=():CustomRuleDraft=>({id:crypto.randomUUID(),revision:0,name:'',priority:100,event:'APPOINTMENT_CREATED',delayMinutes:0,locationIds:[],conditions:{vip:'ANY',upcoming:'ANY',attendance:'ANY',tagIds:[]},actions:[]});

const toggle=(values:string[],id:string)=>values.includes(id)?values.filter(v=>v!==id):[...values,id];

function Choices({label,help,choices,values,onChange}:{label:string;help:string;choices:Choice[];values:string[];onChange:(v:string[])=>void}){return <fieldset><legend><strong>{label}</strong><HelpPopup label={label}>{help}</HelpPopup></legend><div style={{display:'flex',flexWrap:'wrap',gap:12}}>{choices.map(c=><label key={c.id}><input type="checkbox" checked={values.includes(c.id)} onChange={()=>onChange(toggle(values,c.id))}/>{c.name}</label>)}{!choices.length&&<span>No choices are available.</span>}</div></fieldset>}

export function CustomRuleSettings(){const[open,setOpen]=useState(false);return <><button type="button" className="gp-btn" data-settings-target="custom-rules" onClick={()=>setOpen(true)}>Custom automatic rules</button>{open&&<RuleEditor onClose={()=>setOpen(false)}/>}</>}

function RuleEditor({onClose}:{onClose:()=>void}){

 const[services,setServices]=useState<Choice[]>([]),[packages,setPackages]=useState<Choice[]>([]),[vipPlans,setVipPlans]=useState<Choice[]>([]);
 const[history,setHistory]=useState<any[]>([]),[rules,setRules]=useState<SavedRule[]>([]),[draft,setDraft]=useState<CustomRuleDraft|null>(null),[employees,setEmployees]=useState<Choice[]>([]),[locations,setLocations]=useState<Choice[]>([]),[tags,setTags]=useState<Choice[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[existingRecords,setExistingRecords]=useState('');

 useEffect(()=>{let active=true;employeeFetch('/api/automation-rules',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'We could not retrieve your rules. Close this window and try again.');if(!active)return;setRules(d.rules||[]);setHistory(d.history||[]);setEmployees((d.employees||[]).map((e:any)=>({id:e.id,name:e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' ')})));setLocations(d.locations||[]);setTags(d.tags||[]);setServices(d.services||[]);setPackages(d.packages||[]);setVipPlans(d.vipPlans||[]);setReady(true);}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[]);

 function change(p:Partial<CustomRuleDraft>){setDraft(d=>d?{...d,...p}:d);setDirty(true)}

 function action(id:string,p:Partial<CustomRuleAction>){if(draft)change({actions:draft.actions.map(a=>a.id===id?{...a,...p}:a)})}

 function canLeave(){return !dirty||window.confirm('Leave without saving your changes to this rule?')}

 function select(id:string){if(!canLeave())return;setDraft(id?structuredClone(rules.find(r=>r.id===id)!):blank());setDirty(false);setExistingRecords('');setMessage('')}

 async function retry(communicationId:string){if(busy)return;setBusy(true);try{const r=await employeeFetch('/api/automation-rules/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({communicationId})}),d=await r.json();if(!r.ok)throw Error(d.error);setMessage(d.message);setHistory(rows=>rows.map(row=>row.id===communicationId?{...row,canRetry:false,result:'Retry requested; current eligibility will be checked.'}:row));}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function save(){if(!draft||busy||!ready)return;setBusy(true);try{const r=await employeeFetch('/api/automation-rules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}),d=await r.json();if(!r.ok)throw Error(d.error||'We could not save this draft. Your changes are still here; please try again.');setDraft(d.saved);setRules(v=>[...v.filter(x=>x.id!==d.saved.id),d.saved]);setDirty(false);setMessage('Draft saved. This rule is not running and will not send messages or create staff tasks.');}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}

 const savedRule=rules.find(r=>r.id===draft?.id),running=savedRule?.state==='ACTIVE',canEnable=!!draft&&executableStaffEvents.includes(draft.event)&&draft.actions.every(a=>a.kind!=='MESSAGE'||executableMessageEvents.includes(draft.event));

 async function setRunning(state:'ACTIVE'|'DRAFT'){if(!savedRule||busy||dirty)return;setBusy(true);try{const r=await employeeFetch('/api/automation-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:savedRule.id,revision:savedRule.revision,state,existingRecords})}),d=await r.json();if(!r.ok)throw Error(d.error||'We could not change this rule. Please try again.');setDraft(d.saved);setRules(v=>v.map(x=>x.id===d.saved.id?d.saved:x));setExistingRecords('');setMessage(state==='ACTIVE'?'Rule turned on. GroomPro will check for matching events.':'Rule paused. You can edit its draft; tasks and notices already created remain available.');}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}

 return <FloatingEditorWindow windowKey="custom-rules" title="Custom automatic rules" closeDisabled={busy} onClose={()=>{if(canLeave())onClose()}}><div className="gp-rule-editor" style={{padding:16,display:'grid',gap:14}}>

 <p>Prepare a task, staff notification or customer message for a specific event. Appointment, VIP membership, unfinished-booking and overdue-task rules can create staff tasks and notices. Custom pickup, appointment-change, cancellation and closing messages replace the matching standard message. Booking notices are separate from requests to confirm attendance. VIP membership, unfinished-booking, check-in and no-show events can also send customer messages. Unfinished-booking rules use the shop’s saved inactivity period and stop when booking resumes or staff completes the follow-up. Balance Owed rules can send one reminder per recorded increase and stop if the balance is paid first. They do not add charges or allow unpaid grooming sales. Other events remain drafts until their delivery is completed.</p>

 <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}><label><strong>Saved rule</strong><HelpPopup label="Saved rule">Review a rule you previously prepared. Saving a draft does not turn it on.</HelpPopup><select aria-label="Saved rule" value={rules.some(r=>r.id===draft?.id)?draft!.id:''} disabled={!ready||busy} onChange={e=>select(e.target.value)}><option value="">Choose a rule</option>{rules.map(r=><option key={r.id} value={r.id}>{r.name} — {r.state==='ACTIVE'?'On':'Draft / paused'}</option>)}</select></label><button type="button" disabled={!ready||busy} onClick={()=>select('')}>New rule</button></div>

 {savedRule&&<div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}><strong>{running?'Rule is on':'Rule is off'}</strong>{running?<button type="button" disabled={busy} onClick={()=>setRunning('DRAFT')}>Pause rule to edit</button>:<><label><strong>When turning on</strong><HelpPopup label="Existing matching records">Choose new events only, or include earlier events that still match. GroomPro will not repeat actions it already completed for an event.</HelpPopup><select aria-label="Existing matching records" value={existingRecords} onChange={e=>setExistingRecords(e.target.value)}><option value="">Choose which records to include</option><option value="NEW_ONLY">New events only</option><option value="INCLUDE">Include existing matching records</option></select></label><button type="button" disabled={busy||dirty||!existingRecords||!canEnable} onClick={()=>setRunning('ACTIVE')}>Turn on rule</button>{!canEnable&&<span>This event or customer-message action is not ready to turn on yet.</span>}{dirty&&<span>Save your changes before turning the rule on.</span>}</>}</div>}

 <fieldset disabled={!draft||busy||running} style={{display:'grid',gap:14,minWidth:0}}><legend><strong>Rule details</strong></legend>

 <label><strong>Rule name</strong><HelpPopup label="Rule name">Choose a name your team will recognize, such as Follow up after a VIP cancellation request.</HelpPopup><input aria-label="Rule name" maxLength={180} value={draft?.name||''} onChange={e=>change({name:e.target.value})}/></label>

 <label><strong>When this happens</strong><HelpPopup label="When this happens">Choose the event that this draft is intended to respond to. A shop accepting a booking is different from a customer confirming attendance.</HelpPopup><select aria-label="Rule event" value={draft?.event||'APPOINTMENT_CREATED'} onChange={e=>change({event:e.target.value as CustomRuleDraft['event']})}>{customRuleEvents.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>

 <label><strong>Wait (minutes)</strong><HelpPopup label="Rule wait">Use zero for no delay, or allow time before the planned follow-up. After activation, GroomPro checks that the event still applies before creating the follow-up.</HelpPopup><input aria-label="Wait in minutes" type="number" min={0} max={525600} step={1} value={draft?.delayMinutes??''} onChange={e=>change({delayMinutes:Number(e.target.value)})}/></label>

 {locations.length>1&&<Choices label="Locations" help="Leave all unchecked to include all shops in this business, or choose the shops this rule should cover." choices={locations} values={draft?.locationIds||[]} onChange={locationIds=>change({locationIds})}/>}

 <fieldset style={{display:'grid',gap:10,minWidth:0}}><legend><strong>Customer conditions</strong><HelpPopup label="Customer conditions">All selected conditions must match. Leave a condition unrestricted when it should not limit the rule.</HelpPopup></legend>

 <label><strong>VIP membership</strong><select aria-label="VIP condition" value={draft?.conditions.vip||'ANY'} onChange={e=>draft&&change({conditions:{...draft.conditions,vip:e.target.value as CustomRuleDraft['conditions']['vip']}})}><option value="ANY">Any membership status</option><option value="ACTIVE">Has an active membership</option><option value="NOT_ACTIVE">No active membership</option></select></label>

 <label><strong>Future appointment</strong><select aria-label="Future appointment condition" value={draft?.conditions.upcoming||'ANY'} onChange={e=>draft&&change({conditions:{...draft.conditions,upcoming:e.target.value as CustomRuleDraft['conditions']['upcoming']}})}><option value="ANY">With or without a future appointment</option><option value="YES">Has a future appointment</option><option value="NO">No future appointment</option></select></label>

 <label><strong>Attendance confirmation</strong><select aria-label="Attendance condition" value={draft?.conditions.attendance||'ANY'} onChange={e=>draft&&change({conditions:{...draft.conditions,attendance:e.target.value as CustomRuleDraft['conditions']['attendance']}})}><option value="ANY">Any attendance response</option><option value="CONFIRMED">Customer has confirmed</option><option value="UNCONFIRMED">Customer has not confirmed</option></select></label>

 <label><strong>Rule priority</strong><HelpPopup label="Rule priority">Once rules are activated, when several match, GroomPro uses the matching rule with the lowest number. Put a specific VIP rule before a general rule. Equal priorities follow rule-name order. A delayed matching message still replaces the standard message.</HelpPopup><input aria-label="Rule priority" type="number" min="1" max="10000" value={draft?.priority??100} onChange={e=>change({priority:Number(e.target.value)})}/></label>

 <Choices label="Required customer tags" help="A customer must have every selected tag. Leave all unchecked when no tag is required." choices={tags} values={draft?.conditions.tagIds||[]} onChange={tagIds=>draft&&change({conditions:{...draft.conditions,tagIds}})}/><Choices label="Dog’s assigned package" help="Choose one or more packages. An active dog must have one of these packages assigned in its pet profile. Leave blank for any package." choices={packages} values={draft?.conditions.petPackageIds||[]} onChange={petPackageIds=>draft&&change({conditions:{...draft.conditions,petPackageIds}})}/>
 <Choices label="Service in dog’s assigned package" help="Choose a service included in the dog’s assigned package. GroomPro checks the saved assignment, not an old appointment or the dog’s breed default." choices={services} values={draft?.conditions.petServiceIds||[]} onChange={petServiceIds=>draft&&change({conditions:{...draft.conditions,petServiceIds}})}/>
 <Choices label="Dog’s VIP plan" help="Choose active VIP plans, such as Full-Wash VIP. The same dog must match every type of dog condition you select. Paused or ended memberships do not qualify. One customer message covers their matching dogs." choices={vipPlans} values={draft?.conditions.petVipPlanIds||[]} onChange={petVipPlanIds=>draft&&change({conditions:{...draft.conditions,petVipPlanIds}})}/>
 </fieldset>

 <fieldset style={{display:'grid',gap:12,minWidth:0}}><legend><strong>Planned actions</strong><HelpPopup label="Planned actions">Choose what the rule should do when activated. Tasks and staff notifications name employees; customer messages use the customer's contact preferences.</HelpPopup></legend>

 {!draft?.actions.length&&<p>No actions added. Choose Add action to prepare the follow-up.</p>}

 {draft?.actions.map((a,index)=><fieldset key={a.id} style={{display:'grid',gap:10,minWidth:0}}><legend><strong>Action {index+1}</strong></legend>

 <label><strong>Action</strong><select data-help="Choose whether this rule creates a staff task, shows a staff notice or sends a customer message when its event and conditions match." aria-label={'Action '+(index+1)+' type'} value={a.kind} onChange={e=>action(a.id,{kind:e.target.value as CustomRuleAction['kind'],assigneeIds:[],channels:e.target.value==='MESSAGE'?['EMAIL']:[]})}><option value="TASK">Create staff task</option><option value="NOTICE">Notify staff in GroomPro</option><option value="MESSAGE">Send customer message</option></select></label>

 <label><strong>Title / email subject</strong><HelpPopup label="Action title">Use a clear task or notification title. For email this becomes the subject; text messages use the message below.</HelpPopup><input aria-label={'Action '+(index+1)+' title'} maxLength={180} value={a.title} onChange={e=>action(a.id,{title:e.target.value})}/></label>

 <label><strong>Instructions / message</strong><HelpPopup label="Action instructions">Write what the employee or customer needs to know. Supported placeholders are filled from the matching record; missing information must not be invented.</HelpPopup><textarea aria-label={'Action '+(index+1)+' message'} rows={4} maxLength={4000} value={a.body} onChange={e=>action(a.id,{body:e.target.value})}/></label>

 {a.kind==='MESSAGE'&&<label><input type="checkbox" checked={a.marketing===true} onChange={e=>action(a.id,{marketing:e.target.checked})}/>Promotional message<HelpPopup label="Promotional message">Turn this on for offers or promotions. These messages share the tenant’s marketing limit with rebooking invitations; ordinary appointment, account and document notices do not use that allowance.</HelpPopup></label>}
 {a.kind==='MESSAGE'&&draft.event==='CLOSED'&&<label><strong>Replace closing message</strong><HelpPopup label="Replace closing message">Choose which closing message this wording replaces. The other keeps its existing settings and wording; the report card itself stays saved.</HelpPopup><select aria-label="Replace closing message" value={a.replaces||''} onChange={e=>action(a.id,{replaces:e.target.value as 'REVIEW'|'REPORT_CARD'})}><option value="">Choose a closing message</option><option value="REVIEW">Review request</option><option value="REPORT_CARD">Report-card message</option></select></label>}
 {a.kind==='MESSAGE'?<Choices label="Customer message channels" help="Choose text, email or both. The customer's saved communication preferences still apply. Replacement pickup, change, cancellation and closing messages also require automatic appointment messages to be on in Settings → Communications." choices={[{id:'SMS',name:'Text'},{id:'EMAIL',name:'Email'}]} values={a.channels} onChange={channels=>action(a.id,{channels:channels as CustomRuleAction['channels']})}/>:<Choices label="Employees" help="Choose the employees who should receive this task or notification, including Customer Service Associates." choices={employees} values={a.assigneeIds} onChange={assigneeIds=>action(a.id,{assigneeIds})}/>}

 <button type="button" onClick={()=>change({actions:draft.actions.filter(v=>v.id!==a.id)})}>Remove action {index+1}</button></fieldset>)}

 <button type="button" disabled={(draft?.actions.length||0)>=10} onClick={()=>draft&&change({actions:[...draft.actions,{id:crypto.randomUUID(),kind:'TASK',title:'',body:'',assigneeIds:[],channels:[]}]})}>Add action</button>

 <p>Available placeholders: {customRuleVariables.map(v=>'{'+v+'}').join(', ')}.</p></fieldset>

 <button type="button" className="gp-btn primary" onClick={save}>Save draft</button></fieldset>

 <section aria-label="Recent rule activity"><h3>Recent rule activity<HelpPopup label="Recent rule activity">Shows up to 100 recent rule actions available at this shop. Accepted or queued messages are with the delivery provider; they are not proof the customer received them. A last failed attempt records what happened at that time; a later successful action may also appear. Retry is available for confirmed delivery failures on the current rule version. GroomPro checks whether the message is still needed; uncertain delivery is never retried here. Reopen this window to retrieve the latest results.</HelpPopup></h3><table><thead><tr><th>Recorded</th><th>Rule</th><th>Action</th><th>Result</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{new Date(row.at).toLocaleString()}</td><td>{rules.find(r=>r.id===row.ruleId)?.name||'Rule unavailable'}</td><td>{row.action}</td><td>{row.result}{row.canRetry&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void retry(row.id)}>Retry failed message</button>}</td></tr>)}</tbody></table>{!history.length&&<p>No rule activity is available for this shop yet.</p>}</section>
 <div role="status" aria-live="polite">{helpfulError(message)}</div></div></FloatingEditorWindow>

}
