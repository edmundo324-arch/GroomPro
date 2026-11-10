"use client";
import {useEffect,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {agreementChannels,agreementTitle,type AgreementChannel,type AgreementConfig,type AgreementKind} from '../lib/customer-agreement-model';
import '../../app/customer-forms/forms.css';

const endpoint='/api/customer-agreement/staff';
const channels={link:'Shop sends a link',tablet:'Shop tablet',online:'Online first appointment'};
type Context={tenantId:string;canConfigure?:boolean;channels?:AgreementChannel[];
 profile?:{firstName:string;lastName:string;pets:{id:string;name:string}[]};
 documents?:{id:string;title:string;signedAt:string;sentCopy:boolean}[];config?:AgreementConfig};

async function call(path:string,method='GET',body?:object){
 const response=await employeeFetch(endpoint+path,method==='GET'?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Could not complete this agreement action.');
 return data;
}
function AgreementSettings({tenantId,initial,onSaved}:{tenantId:string;initial:AgreementConfig;onSaved:(config:AgreementConfig)=>void}){
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
 return <section><h3>Agreement settings</h3>
  <fieldset><legend>Where customers can complete forms</legend>
   {agreementChannels.map(channel=><label key={channel}><input type="checkbox" checked={config.channels.includes(channel)}
    onChange={e=>setConfig({...config,channels:e.target.checked?[...config.channels,channel]:config.channels.filter(c=>c!==channel)})}/> {channels[channel]}</label>)}
   <button className="gp-btn" type="button" onClick={()=>setConfig({...config,channels:[...agreementChannels]})}>Restore factory channels</button>
  </fieldset>
  <label>Shop email for signed copies<input type="email" value={config.shopEmail} onChange={e=>setConfig({...config,shopEmail:e.target.value})}/></label>
  {config.channels.includes('online')&&<label>Online booking page (optional)<input type="url" placeholder="https://" value={config.bookingUrl||''} onChange={e=>setConfig({...config,bookingUrl:e.target.value})}/></label>}
  <label>Agreement <select value={kind} onChange={e=>setKind(e.target.value as AgreementKind)}><option value="intake">New Customer Intake</option><option value="vip">VIP Signup Agreement</option></select></label>
  {terms.clauses.map((clause,i)=><fieldset key={i}><legend>Policy section {i+1}</legend>
   <label>Title<input value={clause.title} onChange={e=>edit(i,'title',e.target.value)}/></label>
   <label>Policy text<textarea rows={4} value={clause.text} onChange={e=>edit(i,'text',e.target.value)}/></label>
   <label>Optional video URL<input type="url" value={clause.video||''} onChange={e=>edit(i,'video',e.target.value)}/></label>
   <label><input type="checkbox" checked={clause.initialsRequired!==false} onChange={e=>edit(i,'initialsRequired',e.target.checked)}/> Require handwritten initials</label>
   <button className="gp-btn" type="button" onClick={()=>setConfig({...config,[kind]:{...terms,clauses:terms.clauses.filter((_,index)=>index!==i)}})}>Remove section</button>
  </fieldset>)}
  <button className="gp-btn" type="button" onClick={()=>setConfig({...config,[kind]:{...terms,clauses:[...terms.clauses,{title:'',text:''}]}})}>Add section</button>
  <button className="gp-btn primary" type="button" disabled={busy} onClick={()=>void save()}>Save settings</button>
  {notice&&<p role="status">{notice}</p>}
  {config.channels.includes('online')&&config.intake.clauses.length>0&&<label>Online intake link<input readOnly value={window.location.origin+'/customer-forms?tenant='+encodeURIComponent(tenantId)} onFocus={e=>e.target.select()}/></label>}
 </section>;
}
export function CustomerAgreementTools({customerId}:{customerId?:string}){
 const [opened,setOpened]=useState(false),[context,setContext]=useState<Context|null>(null),[setup,setSetup]=useState(false);
 const [kind,setKind]=useState<AgreementKind>('intake'),[prices,setPrices]=useState<Record<string,string>>({});
 const [path,setPath]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!opened||!customerId)return;
  let live=true;
  const load=()=>call('?customer='+encodeURIComponent(customerId)).then(data=>{if(live)setContext(old=>({...old,...data}));}).catch(e=>{if(live)setError(e.message);});
  void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},12000);
  return()=>{live=false;clearInterval(timer);};
 },[opened,customerId]);
 async function openSettings(){
  setBusy(true);setError('');
  try{const data=await call('');setContext(old=>({...old,...data}));setSetup(true);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function prepare(channel:'link'|'tablet'){
  setBusy(true);setError('');setPath('');
  // Open immediately on the user gesture so the shop tablet does not hit a popup blocker.
  const tablet=channel==='tablet'?window.open('about:blank','_blank'):null;
  if(tablet)tablet.opener=null;
  try{
   const data=await call('','POST',{kind,customerId,channel,prices});
   const url=new URL(data.path,window.location.origin).href;
   if(tablet)tablet.location.href=url;
   setPath(url);
  }catch(e){tablet?.close();setError((e as Error).message);}
  finally{setBusy(false);}
 }
 const available=context?.config?.channels||context?.channels||agreementChannels;
 return <details open={customerId?true:undefined} onToggle={e=>setOpened(e.currentTarget.open)}>
  <summary>{customerId?'Forms & signed agreements':'Customer intake & agreement settings'}</summary>
  {opened&&<div className="gp-agreement">
   {customerId&&<label>Form <select value={kind} onChange={e=>{setKind(e.target.value as AgreementKind);setPath('');}}><option value="intake">{agreementTitle.intake}</option><option value="vip">{agreementTitle.vip}</option></select></label>}
   {kind==='vip'&&<fieldset><legend>Choose dogs and quote a recurring price for each</legend>
    {context?.profile?.pets.map(p=><div key={p.id}>
     <label><input type="checkbox" checked={p.id in prices} onChange={e=>{setPath('');if(e.target.checked)setPrices({...prices,[p.id]:''});else{const next={...prices};delete next[p.id];setPrices(next);}}}/> {p.name}</label>
     {p.id in prices&&<label>{p.name} recurring price ($)<input inputMode="decimal" placeholder="0.00" value={prices[p.id]} onChange={e=>{setPath('');setPrices({...prices,[p.id]:e.target.value});}}/></label>}
    </div>)}
   </fieldset>}
   {available.includes('link')&&<button type="button" className="gp-btn" disabled={busy||kind==='vip'&&!Object.keys(prices).length} onClick={()=>void prepare('link')}>Create customer link</button>}
   {available.includes('tablet')&&<button type="button" className="gp-btn" disabled={busy||kind==='vip'&&!Object.keys(prices).length} onClick={()=>void prepare('tablet')}>Open on shop tablet</button>}
   {path&&<div><label>Customer form link<input value={path} readOnly onFocus={e=>e.target.select()}/></label>
    <button type="button" className="gp-btn" onClick={()=>void navigator.clipboard.writeText(path).catch(()=>setError('Select the link above and copy it.'))}>Copy link</button>
    <a className="gp-btn" href={path} target="_blank" rel="noreferrer">Open form</a>
   </div>}
   {error&&<p role="alert">{error}</p>}
   {!!context?.documents?.length&&<section><h3>Signed copies</h3>{context.documents.map(doc=><p key={doc.id}>
    <a href={endpoint+'?document='+encodeURIComponent(doc.id)}>{doc.title} · {new Date(doc.signedAt).toLocaleDateString()}</a>
    {' · '}{doc.sentCopy?'Email sent':'Email pending or unavailable'}
   </p>)}</section>}
   {(!customerId||context?.canConfigure)&&!setup&&<button type="button" className="gp-btn" onClick={()=>void openSettings()} disabled={busy}>Agreement settings</button>}
   {setup&&context?.config&&<AgreementSettings tenantId={context.tenantId} initial={context.config} onSaved={config=>setContext(old=>old?{...old,config}:old)}/>}
  </div>}
 </details>;
}
