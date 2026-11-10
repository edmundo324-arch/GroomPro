"use client";
import {useEffect,useRef,useState} from 'react';
import {businessId} from '../lib/business-context';
import {employeeFetch} from '../lib/employee-fetch';
import {GROOMPRO_ROLES} from '../lib/roles';

type OwnerForm={firstName:string;lastName:string;pin:string};
type Business={id:string;name:string};
type Employee={id:string;firstName:string;lastName:string;displayName?:string;role:string;active:boolean};
type AccessData={tenants:Business[];currentTenantId:string;canReturnHome:boolean;canManageOwners:boolean;employees?:Employee[];businessOwnerId?:string;access?:{suspended:boolean}};
type Task='create'|'open'|'business'|'employee'|'owner';
const blankOwner={firstName:'',lastName:'',pin:''};
const requestHeaders={'Content-Type':'application/json'};
const validOwner=(owner:OwnerForm)=>Boolean(owner.firstName.trim()&&owner.lastName.trim()&&/^\d{6,10}$/.test(owner.pin));

function BusinessOwnerFields({owner,onChange}:{owner:OwnerForm;onChange:(owner:OwnerForm)=>void}){
 return <fieldset className="gp-platform-form-fields">
  <legend>Business owner</legend>
  <label>First name<input required maxLength={100} value={owner.firstName} onChange={e=>onChange({...owner,firstName:e.target.value})}/></label>
  <label>Last name<input required maxLength={100} value={owner.lastName} onChange={e=>onChange({...owner,lastName:e.target.value})}/></label>
  <label>Sign-in PIN<input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,10}" maxLength={10} value={owner.pin} onChange={e=>onChange({...owner,pin:e.target.value})}/></label>
  <small>Use 6–10 digits. The owner signs in to this business with this PIN.</small>
 </fieldset>;
}

export function PlatformAccessSettings(){
 const [business,setBusiness]=useState({name:'',location:'Main Location',timezone:'America/Chicago'});
 const [owner,setOwner]=useState<OwnerForm>(blankOwner),[existingOwner,setExistingOwner]=useState<OwnerForm>(blankOwner);
 const [result,setResult]=useState<{tenantId:string;data:AccessData}|null>(null),[tenantId,setTenant]=useState('');
 const [userId,setUser]=useState(''),[role,setRole]=useState('FRONT'),[active,setActive]=useState(true),[pin,setPin]=useState('');
 const [businessReason,setBusinessReason]=useState(''),[employeeReason,setEmployeeReason]=useState('');
 const [notice,setNotice]=useState<{task:Task;text:string}|null>(null),[busy,setBusy]=useState(false);
 const createSection=useRef<HTMLDetailsElement>(null);
 const data=result?.data,selected=result?.tenantId===tenantId?data:null;
 const suspended=selected?.access?.suspended===true;
 const ownerRequired=!!selected&&businessId(tenantId)&&!selected.businessOwnerId;
 const label=(employee:Employee)=>employee.displayName||[employee.firstName,employee.lastName].join(' ');
 const message=(task:Task)=>notice?.task===task?<p role="status">{notice.text}</p>:null;

 async function read(id:string){
  const response=await employeeFetch('/api/platform-access'+(id?'?tenantId='+encodeURIComponent(id):''));
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  return {tenantId:id,data:data as AccessData};
 }
 useEffect(()=>{
  let cancelled=false;
  read(tenantId).then(value=>{if(!cancelled)setResult(value)}).catch(e=>{if(!cancelled)setNotice({task:'open',text:e.message})});
  return()=>{cancelled=true};
 },[tenantId]);
 function selectBusiness(id:string){
  setTenant(id);setUser('');setPin('');setBusinessReason('');setEmployeeReason('');setExistingOwner(blankOwner);
 }
 async function send(task:Task,body:object,done:(data:any)=>void|Promise<void>){
  if(busy)return;
  setBusy(true);setNotice(null);
  try{
   const response=await employeeFetch('/api/platform-access',{method:'PATCH',headers:requestHeaders,body:JSON.stringify(body)});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Business setup could not complete.');
   await done(data);
  }catch(e){setNotice({task,text:(e as Error).message})}finally{setBusy(false)}
 }
 function createBusiness(){
  return send('create',{action:'CREATE_BUSINESS',...business,owner},data=>{
   selectBusiness(data.tenant.id);
   setBusiness(previous=>({...previous,name:''}));setOwner(blankOwner);
   if(createSection.current)createSection.current.open=false;
   setNotice({task:'open',text:data.tenant.name+' is ready to open.'});
  });
 }
 function updateBusiness(){
  return send('business',{action:'BUSINESS',tenantId,reason:businessReason,suspended:!suspended},async()=>{
   setResult(await read(tenantId));setBusinessReason('');
   setNotice({task:'business',text:suspended?'Business access restored.':'Business access suspended.'});
  });
 }
 function updateEmployee(){
  return send('employee',{action:'EMPLOYEE',tenantId,userId,role,active,pin,reason:employeeReason},async()=>{
   setResult(await read(tenantId));setPin('');setEmployeeReason('');setNotice({task:'employee',text:'Employee access updated.'});
  });
 }
 return <details className="gp-platform-access">
  <summary data-settings-target="platform-business-controls">GroomPro platform access controls</summary>
  <p><strong>Current business</strong> {data?.tenants.find(item=>item.id===data.currentTenantId)?.name||'—'}</p>
  {data?.canReturnHome&&<button type="button" className="gp-btn primary" disabled={busy} onClick={()=>void send('open',{action:'RETURN_HOME'},()=>window.location.reload())}>Back to GroomPro</button>}
  <details ref={createSection} className="gp-platform-task">
   <summary data-settings-target="create-pilot-business">Create business</summary>
   <form className="gp-platform-form" onSubmit={e=>{e.preventDefault();void createBusiness()}}>
    <label>Business name<input required maxLength={100} value={business.name} onChange={e=>setBusiness({...business,name:e.target.value})}/></label>
    <fieldset className="gp-platform-form-fields">
     <legend>First location</legend>
     <label>Location name<input required maxLength={100} value={business.location} onChange={e=>setBusiness({...business,location:e.target.value})}/></label>
     <label>Time zone<input required value={business.timezone} onChange={e=>setBusiness({...business,timezone:e.target.value})}/></label>
    </fieldset>
    <BusinessOwnerFields owner={owner} onChange={setOwner}/>
    <button type="submit" className="gp-btn primary" disabled={busy||!business.name.trim()||!business.location.trim()||!business.timezone.trim()||!validOwner(owner)}>Create business</button>
    {message('create')}
   </form>
  </details>
  <section className="gp-platform-task" aria-label="Open a business">
   <h3>Open a business</h3>
   <div className="gp-platform-action-row">
    <label>Business<select value={tenantId} disabled={busy} onChange={e=>{setNotice(null);selectBusiness(e.target.value)}}>
     <option value="">Choose business</option>{data?.tenants.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {tenantId&&tenantId!==data?.currentTenantId&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void send('open',{action:'OPEN_BUSINESS',tenantId},()=>window.location.reload())}>Open business</button>}
   </div>
   {message('open')}
  </section>
  {tenantId&&selected&&<>
   <section className="gp-platform-task" aria-label="Business access">
    <h3>Business access</h3>
    <p>Status <strong>{suspended?'Suspended':'Active'}</strong></p>
    <form className="gp-platform-form" onSubmit={e=>{e.preventDefault();void updateBusiness()}}>
     <label>{suspended?'Reason for restoration':'Reason for suspension'}<input required maxLength={1000} value={businessReason} onChange={e=>setBusinessReason(e.target.value)}/></label>
     <button type="submit" className="gp-btn" disabled={busy||!businessReason.trim()}>{suspended?'Restore business access':'Suspend business access'}</button>
     {message('business')}
    </form>
   </section>
   <section className="gp-platform-task" aria-label="Employee access">
    <h3>Employee access</h3>
    {ownerRequired&&<form className="gp-platform-form" onSubmit={e=>{e.preventDefault();void send('owner',{action:'ADD_BUSINESS_OWNER',tenantId,owner:existingOwner},async()=>{
     setExistingOwner(blankOwner);setResult(await read(tenantId));setNotice({task:'owner',text:'Business owner added.'});
    })}}>
     <BusinessOwnerFields owner={existingOwner} onChange={setExistingOwner}/>
     <button type="submit" className="gp-btn primary" disabled={busy||!validOwner(existingOwner)}>Add business owner</button>
    </form>}
    {message('owner')}
    {selected.employees?.length?<label className="gp-platform-field">Employee<select value={userId} disabled={busy} onChange={e=>{
     const employee=selected.employees?.find(item=>item.id===e.target.value);
     setUser(e.target.value);setRole(employee?.role||'FRONT');setActive(employee?.active??true);setPin('');setEmployeeReason('');
    }}><option value="">Choose employee</option>{selected.employees.map(item=><option key={item.id} value={item.id}>{label(item)}{item.id===selected.businessOwnerId?' (Business owner)':''}</option>)}</select></label>:<p>No accounts yet.</p>}
    {userId&&<form className="gp-platform-form" onSubmit={e=>{e.preventDefault();void updateEmployee()}}>
     <fieldset className="gp-platform-form-fields" disabled={busy||!selected.canManageOwners&&selected.employees?.find(item=>item.id===userId)?.role==='PLATFORM_OWNER'}>
      <label>Access role<select value={role} onChange={e=>setRole(e.target.value)}>{GROOMPRO_ROLES.filter(r=>r!=='PLATFORM_OWNER'||selected.canManageOwners||role==='PLATFORM_OWNER').map(r=><option key={r} value={r}>{r==='PLATFORM_OWNER'?'Platform Owner':r==='ADMIN'?'Administrator':r.replaceAll('_',' ')}</option>)}</select></label>
      <label className="gp-platform-checkbox"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Employee access enabled</label>
      <label>New PIN (blank keeps the current PIN)<input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e=>setPin(e.target.value)}/></label>
      <label>Reason for changing employee access<input required maxLength={1000} value={employeeReason} onChange={e=>setEmployeeReason(e.target.value)}/></label>
      <button className="gp-btn" type="submit" disabled={busy||!employeeReason.trim()}>Save employee access</button>
     </fieldset>
    </form>}
    {message('employee')}
   </section>
  </>}
 </details>;
}
