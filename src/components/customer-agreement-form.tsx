"use client";
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {agreementTitle,customerFields,dogFields,formatAgreementPrice,type AgreementKind,type AgreementPet,type AgreementProfile,type Quote,type Stroke,type Terms} from '../lib/customer-agreement-model';

type AgreementView={profile:AgreementProfile;kind:AgreementKind;quote:Quote[];terms:Terms;tablet?:boolean;revision:string;business:string};
type Result={id:string;pdf:string;filename:string;emailed:boolean;bookingUrl?:string};
type Requester=(action:string,data?:object,override?:string)=>Promise<any>;

function LiveField({label,value,type='text',save}:{label:string;value?:string|number|null;type?:string;save:(value:string)=>Promise<void>}){
 const [draft,setDraft]=useState(String(value??''));
 useEffect(()=>setDraft(String(value??'')),[value]);
 return <label>{label}<input type={type} value={draft} maxLength={type==='text'?2000:undefined}
  onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==String(value??''))void save(draft).catch(()=>{})}}/></label>;
}
function Initials({label,strokes,onChange}:{label:string;strokes:Stroke[];onChange:(strokes:Stroke[])=>void}){
 const active=useRef<number|null>(null),drawing=useRef<Stroke[]>([]);
 const point=(e:PointerEvent<SVGSVGElement>):[number,number]=>{
  const rect=e.currentTarget.getBoundingClientRect();
  return [Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))];
 };
 return <div><p>{label}</p><svg role="img" aria-label={label} viewBox="0 0 230 70" preserveAspectRatio="none"
  onPointerDown={e=>{if(active.current!==null||strokes.length>=24)return;e.preventDefault();active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);drawing.current=[...strokes,[point(e)]];onChange(drawing.current);}}
  onPointerMove={e=>{if(active.current!==e.pointerId)return;const last=drawing.current.at(-1);if(!last||last.length>=180)return;drawing.current=[...drawing.current.slice(0,-1),[...last,point(e)]];onChange(drawing.current);}}
  onPointerUp={()=>{active.current=null;}} onPointerCancel={()=>{active.current=null;}}>
  {strokes.map((stroke,i)=><polyline key={i} fill="none" stroke="#17324d" strokeWidth="2" strokeLinecap="round" points={stroke.map(([x,y])=>x*230+','+y*70).join(' ')}/>)}
 </svg><button type="button" className="gp-btn" onClick={()=>onChange([])}>Clear initials</button></div>;
}
function DogPhoto({dog,request,save}:{dog:AgreementPet;request:Requester;save:(data:string)=>Promise<void>}){
 const [image,setImage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  let mounted=true;
  if(dog.pictureUrl?.startsWith('/api/customer-agreement/photo')){
   setImage('');
   request('photo',{petId:dog.id}).then(result=>{if(mounted)setImage(result.photo)}).catch(()=>{});
  }else setImage(/^(https:\/\/|\/(?!\/))/.test(dog.pictureUrl||'')?dog.pictureUrl||'':'');
  return()=>{mounted=false};
 },[dog.id,dog.pictureUrl,request]);
 async function upload(file:File){
  try{
   setError('');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw Error('Choose a JPEG, PNG or WebP photo up to 15 MB.');
   const bitmap=await createImageBitmap(file);
   const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not open this photo.');
   ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   const data=canvas.toDataURL('image/jpeg',0.72);
   await save(data);
   setImage(data);
  }catch(e){setError((e as Error).message||'Could not save this photo.');}
 }
 return <div>{image&&<img src={image} alt={String(dog.name)+' on file'}/>}
  <label>{image?'Replace dog photo':'Add dog photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/></label>
  {error&&<p role="alert">{error}</p>}</div>;
}
function downloadPdf(result:Result){
 const bytes=Uint8Array.from(atob(result.pdf),v=>v.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function CustomerAgreementForm(){
 const [station,setStation]=useState(false),[token,setToken]=useState(''),[stage,setStage]=useState('loading'),[view,setView]=useState<AgreementView|null>(null);
 const [phone,setPhone]=useState(''),[code,setCode]=useState(''),[firstName,setFirst]=useState(''),[lastName,setLast]=useState(''),[dogName,setDogName]=useState(''),[email,setEmail]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(0);
 const [selected,setSelected]=useState<string[]>([]),[adopted,setAdopted]=useState(false),[name,setName]=useState('');
 const [checked,setChecked]=useState<number[]>([]),[initials,setInitials]=useState<Record<string,Stroke[]>>({});
 const [result,setResult]=useState<Result|null>(null);
 const queue=useRef<Promise<unknown>>(Promise.resolve()),failedFields=useRef(new Set<string>());
 const connection=useRef({tenant:'',token:''}),attemptedPhone=useRef(''),startedProfile=useRef(false);
 const latestView=useRef<AgreementView|null>(null);
 const request=useRef<Requester>(async(action,data={},override)=>{
  const current=connection.current;
  const response=await fetch('/api/customer-agreement',{method:'POST',headers:{'Content-Type':'application/json'},
   cache:'no-store',body:JSON.stringify({tenant:current.tenant,token:override??current.token,action,...data})});
  const payload=await response.json();
  if(!response.ok)throw Error(payload.error||'Could not complete this step.');
  return payload;
 }).current;
 function apply(data:AgreementView){latestView.current=data;setView(data);setStage(data.profile.id?'form':'create');}
 useEffect(()=>{
  const url=new URL(window.location.href),id=url.searchParams.get('tenant')||'',secret=url.hash.slice(1);
  connection.current={tenant:id,token:secret};setToken(secret);
  if(!id){setNotice('Ask the shop for a customer form link.');setStage('unavailable');return;}
  const resume=url.searchParams.get('tablet')==='1';
  if(!secret&&!resume){setStage('phone');return;}
  request('view',{station:resume}).then(data=>{
   if(data.tabletStation){connection.current.token='';setToken('');history.replaceState(null,'','/customer-forms?tenant='+encodeURIComponent(id)+'&tablet=1');setStation(true);setStage('phone');return;}
   if(data.needsPhone){setStage('phone');return;}
   if(data.signed){setStage('signed');return;}
   apply(data);
  }).catch(e=>{setNotice(e.message);setStage('unavailable');});
  return()=>{window.speechSynthesis?.cancel();};
 },[request]);
 async function action(callback:()=>Promise<void>){
  setBusy(true);setNotice('');
  try{await callback();}catch(e){setNotice((e as Error).message||'Please try again.');}finally{setBusy(false);}
 }
 async function startPhone(){
  const data=await request(station?'startTablet':'sendCode',{phone,station},station?'':undefined);
  connection.current.token=data.token;setToken(data.token);
  if(station&&!data.needsCode)apply(await request('view'));
  else setStage('code');
 }
 useEffect(()=>{
  if(!station||stage!=='phone'||busy)return;
  const digits=phone.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
  if(digits.length!==10||attemptedPhone.current===digits)return;
  const timer=setTimeout(()=>{attemptedPhone.current=digits;void action(startPhone);},400);
  return()=>clearTimeout(timer);
 },[station,stage,phone,busy]);
 function save(fields:Record<string,unknown>){
  const key=String(fields.petId||'customer')+':'+Object.keys(fields).filter(k=>k!=='petId').join(',');
  setPending(n=>n+1);setNotice('');
  const update=queue.current.catch(()=>{}).then(async()=>{apply(await request('edit',{fields}));failedFields.current.delete(key);});
  queue.current=update;
  void update.catch(e=>{failedFields.current.add(key);setNotice(e.message);}).finally(()=>setPending(n=>n-1));
  return update;
 }
 async function sign(){
  await queue.current.catch(()=>{});
  if(failedFields.current.size)throw Error('Correct the unsaved fields before signing.');
  if(!latestView.current)return;
  const signed=await request('sign',{revision:latestView.current.revision,selectedPets:selected,
   signature:{name,adopted,initials,acknowledged:[...checked].sort((a,b)=>a-b)}});
  if((station||latestView.current.tablet)&&signed.emailed){finish(true);return;}
  setResult(signed);setView(null);setName('');setInitials({});setChecked([]);setSelected([]);setStage('complete');
 }
 function finish(emailed=false){
  window.speechSynthesis?.cancel();
  if(station&&connection.current.token)void request('clearTabletForm').catch(()=>{});
  connection.current=station?{tenant:connection.current.tenant,token:''}:{tenant:'',token:''};latestView.current=null;
  attemptedPhone.current='';startedProfile.current=false;setName('');setInitials({});setChecked([]);setSelected([]);
  setResult(null);setView(null);setPhone('');setCode('');setFirst('');setLast('');setDogName('');setEmail('');setToken('');
  setNotice('');setAdopted(false);failedFields.current.clear();
  if(station){setStage('phone');if(emailed)setNotice('Signed copies sent. Ready for the next customer.');}
  else{history.replaceState(null,'','/customer-forms');setStage('finished');if(emailed)setNotice('Signed copies sent.');}
 }
 function startProfile(){
  if(startedProfile.current||!firstName.trim()||!lastName.trim()||!/^\S+@\S+\.\S+$/.test(email.trim()))return;
  startedProfile.current=true;
  void action(async()=>{try{await save({firstName,lastName,email});}catch(error){startedProfile.current=false;throw error;}});
 }
 return <main className="gp-agreement">
  <h1>{view?agreementTitle[view.kind]:station?'New Customer Intake':'Customer forms'}</h1>
  {view?.business&&<p>{view.business}</p>}
  {notice&&<p role="alert">{notice}</p>}
  {stage==='loading'&&<p>Opening form…</p>}
  {stage==='phone'&&<form onSubmit={e=>{e.preventDefault();if(!busy)void action(startPhone);}}><label>Mobile phone<input type="tel" autoComplete={station?'off':'tel'} required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   {!station&&<button className="gp-btn primary" disabled={busy}>Text me a code</button>}
   {station&&busy&&<p role="status">Finding your profile…</p>}
   {station&&notice&&phone&&<button className="gp-btn" disabled={busy}>Try again</button>}
  </form>}
  {stage==='code'&&<form onSubmit={e=>{e.preventDefault();void action(async()=>{await request('verifyCode',{code},token);apply(await request('view'));});}}>
   <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="gp-btn primary" disabled={busy}>Verify phone</button></form>}
  {stage==='create'&&<form onSubmit={e=>{e.preventDefault();startProfile();}}>
   <label>First name<input autoComplete="given-name" required value={firstName} onChange={e=>setFirst(e.target.value)}/></label>
   <label>Last name<input autoComplete="family-name" required value={lastName} onChange={e=>setLast(e.target.value)}/></label>
   <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} onBlur={station?startProfile:undefined}/></label>
   {!station&&<button className="gp-btn primary" disabled={busy}>Start my profile</button>}{station&&<button type="submit" hidden>Save profile</button>}</form>}
  {stage==='form'&&view&&<>
   <section><h2>Your profile</h2><p>Changes save to your GroomPro profile as you complete each field.</p>
    <p><strong>Primary phone</strong> {view.profile.phone||'Ask the shop to add your primary phone.'}</p>
    <div className="gp-agreement-grid">{Object.entries(customerFields).map(([key,label])=><LiveField key={key} label={label}
     value={view.profile[key as keyof typeof customerFields]} type={key==='email'?'email':key.endsWith('Phone')?'tel':'text'} save={value=>save({[key]:value})}/>)}</div>
    {pending>0&&<p role="status">Saving changes…</p>}
   </section>
   {view.profile.pets.map(dog=>{
    const quote=view.quote.find(q=>q.petId===dog.id);
    return <section key={dog.id}><h2>{dog.name}</h2>
     <DogPhoto dog={dog} request={request} save={photo=>save({petId:dog.id,photo})}/>
     {quote&&<label><input type="checkbox" checked={selected.includes(dog.id)} onChange={e=>setSelected(e.target.checked?[...selected,dog.id]:selected.filter(id=>id!==dog.id))}/>
      Enroll {dog.name}{quote.planName?' · '+quote.planName:''} · {formatAgreementPrice(quote.priceCents)} recurring</label>}
     <div className="gp-agreement-grid">{Object.entries(dogFields).map(([key,label])=><LiveField key={key} label={label} value={dog[key as keyof typeof dogFields]}
      save={value=>save({petId:dog.id,[key]:value})}/>)}</div>
    </section>;
   })}
   {view.kind==='intake'&&<form onSubmit={e=>{e.preventDefault();void action(async()=>{await save({petId:'',name:dogName});setDogName('');});}}>
    <label>Add a dog<input required value={dogName} onChange={e=>setDogName(e.target.value)}/></label><button className="gp-btn" disabled={busy}>Add dog</button>
   </form>}
   {view.kind==='vip'&&<p><strong>Selected recurring total</strong> {formatAgreementPrice(view.quote.filter(q=>selected.includes(q.petId)).reduce((total,q)=>total+q.priceCents,0))}</p>}
   {view.terms.clauses.map((clause,i)=><section key={i}><h3>{clause.title}</h3>
    {clause.video&&(/\.(mp4|webm)(\?|$)/i.test(clause.video)?<video src={clause.video} controls preload="none"/>:<a href={clause.video} target="_blank" rel="noreferrer">Watch video</a>)}
    <button className="gp-btn" type="button" onClick={()=>{if(window.speechSynthesis){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(clause.text));}}}>Listen</button>
    <p style={{whiteSpace:'pre-wrap'}}>{clause.text}</p>
    <label><input type="checkbox" checked={checked.includes(i)} onChange={e=>setChecked(e.target.checked?[...checked,i]:checked.filter(n=>n!==i))}/> I acknowledge this section</label>
    {clause.initialsRequired!==false&&<Initials label={'Handwrite initials for '+clause.title} strokes={initials[i]||[]} onChange={strokes=>setInitials({...initials,[i]:strokes})}/>}
   </section>)}
   <form onSubmit={e=>{e.preventDefault();void action(sign);}}>
    <h2>Electronic signature</h2>
    <label>Printed name<input required maxLength={191} value={name} onChange={e=>{setName(e.target.value);setAdopted(false);}}/></label>
    {name&&<p className="gp-agreement-signature">{name}</p>}
    <label><input type="checkbox" checked={adopted} onChange={e=>setAdopted(e.target.checked)}/> I adopt this signature and agree to the terms above</label>
    <button className="gp-btn primary" disabled={busy||pending>0||!adopted}>Sign and submit</button>
    <button type="button" className="gp-btn" disabled={busy||pending>0} onClick={()=>void action(async()=>{apply(await request('view'));setAdopted(false);failedFields.current.clear();})}>Reload profile</button>
   </form>
  </>}
  {result&&<section><h2>Agreement signed</h2><p>{result.emailed?'The signed copies were accepted for email delivery.':'Your agreement is saved. Email delivery is unavailable or incomplete.'}</p>
   <button className="gp-btn primary" onClick={()=>downloadPdf(result)}>Download signed PDF</button>
   {!result.emailed&&<button className="gp-btn" disabled={busy} onClick={()=>void action(async()=>{const signed=await request('sign');if(station&&signed.emailed)finish(true);else setResult(signed);})}>Retry email</button>}
   {result.bookingUrl&&<a className="gp-btn" href={result.bookingUrl} rel="noreferrer" onClick={()=>finish()}>Continue to booking</a>}
   <button className="gp-btn" onClick={()=>finish()}>Done</button></section>}
  {stage==='signed'&&<section><h2>Already signed</h2><button className="gp-btn" onClick={()=>void action(async()=>{setResult(await request('sign'));setStage('complete');})}>Open signed copy</button></section>}
  {station&&['code','create','form'].includes(stage)&&<button className="gp-btn" disabled={busy||pending>0} onClick={()=>finish()}>Start over</button>}
  {stage==='finished'&&<p>Thank you. The shop can open another form when ready.</p>}
 </main>;
}
