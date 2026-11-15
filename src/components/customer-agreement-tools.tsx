"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {DismissButton} from './dismiss-button';
import {employeeFetch} from '../lib/employee-fetch';
import {agreementChannels,agreementTitle,type AgreementChannel,type AgreementConfig,type AgreementKind} from '../lib/customer-agreement-model';
import '../../app/customer-forms/forms.css';

const endpoint='/api/customer-agreement/staff';
const channels={link:'Shop sends a link',tablet:'Shop tablet',online:'Online first appointment'};
const channelHelp={
 link:'Staff can create a link and send it to a customer to complete the form on their own device.',
 tablet:'Staff can open the intake form on a shop tablet for customers to complete in person.',
 online:'New customers can complete intake online before booking their first appointment.',
};
type Context={tenantId:string;canConfigure?:boolean;channels?:AgreementChannel[];
 profile?:{firstName:string;lastName:string;pets:{id:string;name:string}[]};
 documents?:{id:string;title:string;signedAt:string;sentCopy:boolean}[];config?:AgreementConfig};

async function call(path:string,method='GET',body?:object){
 const response=await employeeFetch(endpoint+path,method==='GET'?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Could not complete this agreement action.');
 return data;
}
function AgreementHelp({label,children}:{label:string;children:ReactNode}){
 return <details className="gp-agreement-help">
  <summary aria-label={'Help with '+label}>?</summary>
  <p>{children}</p>
 </details>;
}
function AgreementField({label,help,children}:{label:string;help:string;children:(id:string)=>ReactNode}){
 const id=useId();
 return <div className="gp-agreement-field">
  <div className="gp-agreement-field-label"><label htmlFor={id}>{label}</label><AgreementHelp label={label}>{help}</AgreementHelp></div>
  {children(id)}
 </div>;
}
function AgreementSettings({tenantId,initial,onSaved,onClose}:{tenantId:string;initial:AgreementConfig;onSaved:(config:AgreementConfig)=>void;onClose:()=>void}){
 const [config,setConfig]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[kind,setKind]=useState<AgreementKind>('intake');
 const terms=config[kind];
 function edit(index:number,key:'title'|'text'|'video'|'initialsRequired',value:string|boolean){
  setConfig({...config,[kind]:{...terms,clauses:terms.clauses.map((clause,i)=>i===index?{...clause,[key]:value}:clause)}});
 }
 async function save(){
  setBusy(true);setNotice('');
  try{const data=await call('','PUT',config);setConfig(data.config);onSaved(data.config);setNotice('Agreement settings saved.');}
  catch(error){setNotice((error as Error).message);}finally{setBusy(false);}
 }
 return <section className="gp-agreement-settings">
  <div className="gp-agreement-settings-header"><h3>Agreement settings</h3><DismissButton label="Close Agreement Settings" disabled={busy} onClick={onClose}/></div>
  <fieldset><legend>Where customers can complete forms</legend>
   {agreementChannels.map(channel=><div className="gp-agreement-field-label" key={channel}><label><input type="checkbox" checked={config.channels.includes(channel)}
    onChange={e=>setConfig({...config,channels:e.target.checked?[...config.channels,channel]:config.channels.filter(c=>c!==channel)})}/> {channels[channel]}</label>
    <AgreementHelp label={channels[channel]}>{channelHelp[channel]}</AgreementHelp></div>)}
   <div className="gp-agreement-field-label">
    <button className="gp-btn" type="button" onClick={()=>setConfig({...config,channels:[...agreementChannels]})}>Restore factory channels</button>
    <AgreementHelp label="Restore factory channels">Turns all three ways of completing forms back on. Click Save settings to apply the change.</AgreementHelp>
   </div>
  </fieldset>
  {config.channels.includes('tablet')&&<div className="gp-agreement-field-label"><label><input type="checkbox" checked={config.tabletVerifyExisting===true} onChange={e=>setConfig({...config,tabletVerifyExisting:e.target.checked})}/> Text code needed for existing profiles</label>
   <AgreementHelp label="Text code needed for existing profiles">When a customer enters a phone number that matches a saved profile on the shop tablet, GroomPro texts them a code before showing their saved details.</AgreementHelp></div>}
  <AgreementField label="Shop email for signed copies" help="Enter the shop email address that should receive a PDF copy of each signed agreement.">
   {id=><input id={id} type="email" value={config.shopEmail} onChange={e=>setConfig({...config,shopEmail:e.target.value})}/>}
  </AgreementField>
  {config.channels.includes('online')&&<AgreementField label="Online booking page (optional)" help="Enter the secure link to your booking page. Customers can use it to continue to booking after signing online.">
   {id=><input id={id} type="url" placeholder="https://" value={config.bookingUrl||''} onChange={e=>setConfig({...config,bookingUrl:e.target.value})}/>}
  </AgreementField>}
  <AgreementField label="Agreement" help="Choose which form’s policies to edit. Each form has its own policy sections.">
   {id=><select id={id} value={kind} onChange={e=>setKind(e.target.value as AgreementKind)}><option value="intake">New Customer Intake</option><option value="vip">VIP Signup Agreement</option></select>}
  </AgreementField>
  {terms.clauses.map((clause,i)=><fieldset key={i}><legend>Policy section {i+1}</legend>
   <AgreementField label="Title" help="Give this policy a short name customers can recognize, such as Late pickup.">
    {id=><input id={id} value={clause.title} onChange={e=>edit(i,'title',e.target.value)}/>}
   </AgreementField>
   <AgreementField label="Policy text" help="Write the policy customers will read before signing. This wording appears in the signed agreement.">
    {id=><textarea id={id} rows={4} value={clause.text} onChange={e=>edit(i,'text',e.target.value)}/>}
   </AgreementField>
   <AgreementField label="Optional video URL" help="Add a video link customers can watch alongside this policy before signing.">
    {id=><input id={id} type="url" value={clause.video||''} onChange={e=>edit(i,'video',e.target.value)}/>}
   </AgreementField>
   <div className="gp-agreement-field-label"><label><input type="checkbox" checked={clause.initialsRequired!==false} onChange={e=>edit(i,'initialsRequired',e.target.checked)}/> Require handwritten initials</label>
    <AgreementHelp label="Require handwritten initials">Ask customers to draw their initials for this specific policy in addition to signing the agreement.</AgreementHelp></div>
   <div className="gp-agreement-field-label">
    <button className="gp-btn" type="button" onClick={()=>setConfig({...config,[kind]:{...terms,clauses:terms.clauses.filter((_,index)=>index!==i)}})}>Remove section</button>
    <AgreementHelp label="Remove section">Removes this policy from the selected agreement when you save. Previously signed copies keep their original wording.</AgreementHelp>
   </div>
  </fieldset>)}
  <div className="gp-agreement-field-label">
   <button className="gp-btn" type="button" onClick={()=>setConfig({...config,[kind]:{...terms,clauses:[...terms.clauses,{title:'',text:''}]}})}>Add section</button>
   <AgreementHelp label="Add section">Adds one policy to the agreement you selected. For example, add a Late pickup policy, write the details, and choose whether customers should initial it. Then click Save settings.</AgreementHelp>
   <button className="gp-btn primary" type="button" disabled={busy} onClick={()=>void save()}>Save settings</button>
   <AgreementHelp label="Save settings">Applies the form options and policies you edited. Use × to close the panel and discard unsaved edits.</AgreementHelp>
  </div>
  {notice&&<p role="status">{notice}</p>}
  {config.channels.includes('online')&&config.intake.clauses.length>0&&<AgreementField label="Online intake link" help="Copy this link to share the New Customer Intake form online. Customers can open it and fill it out before booking.">
   {id=><input id={id} readOnly value={window.location.origin+'/customer-forms?tenant='+encodeURIComponent(tenantId)} onFocus={e=>e.target.select()}/>}
  </AgreementField>}
 </section>;
}
export function CustomerAgreementTools({customerId}:{customerId?:string}){
 const [context,setContext]=useState<Context|null>(null),[setup,setSetup]=useState(false);
 const settingsButton=useRef<HTMLButtonElement>(null);
 function closeSettings(){
  setSetup(false);
  settingsButton.current?.focus();
 }
 const [path,setPath]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!customerId)return;
  let live=true;
  const load=()=>call('?customer='+encodeURIComponent(customerId)).then(data=>{if(live)setContext(old=>({...old,...data}));}).catch(e=>{if(live)setError(e.message);});
  void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},12000);
  return()=>{live=false;clearInterval(timer);};
 },[customerId]);
 async function openSettings(){
  if(setup){closeSettings();return;}
  setBusy(true);setError('');
  try{const data=await call('');setContext(old=>({...old,...data}));setSetup(true);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function prepare(channel:'link'|'tablet'){
  setBusy(true);setError('');setPath('');
  const tablet=channel==='tablet'?window.open('about:blank','_blank'):null;
  if(tablet)tablet.opener=null;
  try{
   const data=await createCustomerAgreement({kind:'intake',customerId,channel});
   const url=new URL(data.path,window.location.origin).href;
   if(channel==='tablet'){if(tablet)tablet.location.href=url;else window.location.assign(url);}
   else setPath(url);
  }catch(e){tablet?.close();setError((e as Error).message);}
  finally{setBusy(false);}
 }
 const available=context?.config?.channels||context?.channels||agreementChannels;
 return <div className="gp-intake-tools">
  <div className="gp-intake-actions">
   {(!customerId||context?.canConfigure)&&<button ref={settingsButton} type="button" className="gp-btn" onClick={()=>void openSettings()} disabled={busy} aria-expanded={setup}>Agreement Settings</button>}
   {available.includes('link')&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void prepare('link')}>Create Link</button>}
   {available.includes('tablet')&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void prepare('tablet')}>Open Tablet</button>}
  </div>
  {(path||error||setup||!!context?.documents?.length)&&<div className="gp-agreement gp-intake-panel">
   {path&&<div><label>Customer form link<input value={path} readOnly onFocus={e=>e.target.select()}/></label>
    <button type="button" className="gp-btn" onClick={()=>void navigator.clipboard.writeText(path).catch(()=>setError('Select the link above and copy it.'))}>Copy link</button>
    <a className="gp-btn" href={path} target="_blank" rel="noreferrer">Open form</a>
   </div>}
   {error&&<p role="alert">{error}</p>}
   {!!context?.documents?.length&&<section><h3>Signed copies</h3>{context.documents.map(doc=><p key={doc.id}>
    <a href={endpoint+'?document='+encodeURIComponent(doc.id)}>{doc.title} · {new Date(doc.signedAt).toLocaleDateString()}</a>
    {' · '}{doc.sentCopy?'Email accepted':'Email pending or unavailable'}
   </p>)}</section>}
   {setup&&context?.config&&<AgreementSettings tenantId={context.tenantId} initial={context.config} onClose={closeSettings} onSaved={config=>setContext(old=>old?{...old,config}:old)}/>}
  </div>}
 </div>;
}
export function createCustomerAgreement(input:object){
 return call('','POST',input) as Promise<{path:string;token:string}>;
}
