'use client';
import {SearchableSelect} from './searchable-select';
import {useEffect,useRef,useState} from 'react';
import {BusinessLibrary} from './business-library';
import {HelpPopup} from './help-popup';
import {employeeFetch} from '../lib/employee-fetch';
export function MessageTemplatePicker({customerId,channel,onInsert}:{customerId:string;channel:string;onInsert:(body:string)=>void}){
 const [templates,setTemplates]=useState<any[]>([]),[appointments,setAppointments]=useState<any[]>([]),[templateId,setTemplate]=useState(''),[ticketId,setTicket]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [libraryOpen,setLibraryOpen]=useState(false),[libraryLoaded,setLibraryLoaded]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const refresh=(event:Event)=>{if((event as CustomEvent).detail?.kind==='message-templates')setRevision(v=>v+1)};window.addEventListener('groompro:library-changed',refresh);return()=>window.removeEventListener('groompro:library-changed',refresh)},[]);
 const context=customerId+'|'+channel,latest=useRef(context);latest.current=context;
 useEffect(()=>{setTemplate('');setTicket('');setTemplates([]);setAppointments([]);setError('');setBusy(false)},[customerId,channel]);
 useEffect(()=>{let stale=false;setError('');
 employeeFetch('/api/message-templates?'+new URLSearchParams({customerId,channel})).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!stale){setTemplates(d.templates);setTemplate(id=>d.templates.some((t:any)=>t.id===id)?id:'');setAppointments(d.appointments);}}).catch(e=>{if(!stale)setError(e.message)});return()=>{stale=true};},[customerId,channel,revision]);
 async function insert(){setBusy(true);setError('');try{const r=await employeeFetch('/api/message-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId,channel,templateId,ticketId})}),d=await r.json();if(latest.current!==context)return;if(!r.ok)throw Error(d.error);onInsert(d.body);}catch(e){if(latest.current===context)setError((e as Error).message)}finally{if(latest.current===context)setBusy(false)}}
 return <fieldset data-module-name="Messaging" style={{minWidth:0}}><legend>Saved Message</legend>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
 <div><SearchableSelect aria-label="Choose a Template" data-help="Choose reusable text or email wording for this customer. To create or change the saved wording, open Messaging → Message Templates below. Choosing a template does not send a message." value={templateId} onChange={e=>setTemplate(e.target.value)}><option value="">Choose a Template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</SearchableSelect></div>
 <select aria-label="Appointment for Message" data-help="Choose the visit this message concerns so its date, time and dogs come from the correct appointment. This is required when the saved wording includes appointment details." value={ticketId} onChange={e=>setTicket(e.target.value)}><option value="">Choose Appointment When Needed</option>{appointments.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
 <div><button type="button" className="gp-btn" disabled={!customerId||!templateId||busy} onClick={insert}>Insert Saved Message</button><HelpPopup label="Insert Saved Message">Add the selected template to the message below, using this customer's details and the appointment you selected. Your existing text stays in place. Review it before sending. To change the reusable wording, open Messaging → Message Templates.</HelpPopup></div>
 </div>
 <p>Review the wording below before sending. Inserting a saved message does not send it.</p>
 <details open={libraryOpen} onToggle={e=>{setLibraryOpen(e.currentTarget.open);if(e.currentTarget.open)setLibraryLoaded(true)}}><summary className="gp-label" data-help-name="Message Templates" data-help-path="Messaging → Message Templates" data-help="Create or edit reusable text and email messages here. Owners and managers can save changes; existing staff permissions still apply. Saving a template does not send it to customers.">Message Templates</summary>{libraryLoaded&&<BusinessLibrary kind="message-templates" moduleName="Messaging"/>}</details>
 {error&&<p role="alert">{error}</p>}</fieldset>;
}
