"use client";

import {useEffect,useState} from "react";

import {employeeFetch} from "@/src/lib/employee-fetch";

type Employee={id:string;firstName:string;lastName:string;role:string;jobTitle?:string|null;locationId:string|null;active:boolean};

type Shift={id:string;userId:string;dayOfWeek:number;startTime:string;endTime:string;active:boolean};

const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const roles=["ADMIN","MANAGER","FLOOR_MANAGER","FRONT","BACK","MASTER_GROOMER","GROOMER","SALES"];

const blank={id:"",firstName:"",lastName:"",role:"FRONT",jobTitle:"",locationId:"",pin:"",active:true};

function clock(t:string){const[h,m]=t.split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h<12?"am":"pm"}`}

export function EmployeeWeek(){

 const[employees,setEmployees]=useState<Employee[]>([]),[shifts,setShifts]=useState<Shift[]>([]),[locations,setLocations]=useState<{id:string;name:string}[]>([]),[form,setForm]=useState<typeof blank|null>(null),[selected,setSelected]=useState<{employee:Employee;day:number;id?:string;start:string;end:string}|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[query,setQuery]=useState(""),[inactive,setInactive]=useState(false);

 async function load(){try{const responses=await Promise.all([fetch('/api/employees',{cache:'no-store'}),fetch('/api/employee-schedules',{cache:'no-store'}),fetch('/api/locations',{cache:'no-store'})]);const data=await Promise.all(responses.map(r=>r.json()));if(responses.some(r=>!r.ok))throw Error(data.find(d=>d.error)?.error||'Could not load schedules.');setEmployees(data[0].employees);setShifts(data[1].schedules);setLocations(data[2].locations)}catch(e){setMessage(e instanceof Error?e.message:'Could not load schedules.')}finally{setLoading(false)}}

 useEffect(()=>{void load()},[]);

 async function save(url:string,method:string,body:object){setBusy(true);setMessage('');try{const r=await employeeFetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Save failed.');setForm(null);setSelected(null);await load();setMessage('Saved.')}catch(e){setMessage(e instanceof Error?e.message:'Save failed.')}finally{setBusy(false)}}

 return <section><div className="gp-staff-week-toolbar"><div><h2>Employee schedules</h2><p>Recurring weekly schedule · Click a day to change hours, or an employee to edit their profile.</p></div><button className="gp-btn primary" onClick={()=>{setSelected(null);setForm({...blank})}}>+ Add Employee</button></div><div className="gp-staff-week-toolbar"><input aria-label="Find employee" placeholder="Find employee" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={inactive} onChange={e=>setInactive(e.target.checked)}/> Include inactive</label><span className="gp-shift working">Working</span><span className="gp-shift off">Off / no recurring hours</span></div>{message&&<p role="status">{message}</p>}

 {form&&<form className="gp-settings-card" onSubmit={e=>{e.preventDefault();void save('/api/employees',form.id?'PATCH':'POST',form)}}><h3>{form.id?'Edit employee':'Add employee'}</h3><fieldset disabled={busy} className="gp-staff-week-editor">{(['firstName','lastName','jobTitle'] as const).map((key,i)=><label key={key}>{['First name','Last name','Job title (e.g. Paw Walker)'][i]}<input required={key!=='jobTitle'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Access role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(r=><option key={r}>{r}</option>)}</select></label><label>Location<select value={form.locationId} onChange={e=>setForm({...form,locationId:e.target.value})}><option value="">No assigned location / outside marketing</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>{form.id?'New PIN (blank keeps current PIN)':'PIN'}<input type="password" inputMode="numeric" autoComplete="new-password" required={!form.id} pattern="[0-9]{4,10}" value={form.pin} onChange={e=>setForm({...form,pin:e.target.value})}/></label><label><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label><button className="gp-btn primary">Save employee</button><button type="button" className="gp-btn" onClick={()=>setForm(null)}>Cancel</button></fieldset></form>}

 {selected&&<form className="gp-settings-card" onSubmit={e=>{e.preventDefault();const values=new FormData(e.currentTarget);void save('/api/employee-schedules','PUT',{userId:selected.employee.id,dayOfWeek:selected.day,startTime:String(values.get('start')),endTime:String(values.get('end'))})}}><h3>{selected.employee.firstName} {selected.employee.lastName} · Every {days[selected.day]}</h3><p>This changes the recurring weekly schedule.</p><fieldset disabled={busy} className="gp-staff-week-editor"><label>Start<input name="start" type="time" required value={selected.start} onChange={e=>setSelected({...selected,start:e.target.value})}/></label><label>End<input name="end" type="time" required value={selected.end} onChange={e=>setSelected({...selected,end:e.target.value})}/></label><button className="gp-btn primary">Save hours</button>{selected.id&&<button type="button" className="gp-btn" onClick={()=>void save('/api/employee-schedules','DELETE',{id:selected.id})}>Set day off</button>}<button type="button" className="gp-btn" onClick={()=>setSelected(null)}>Cancel</button></fieldset></form>}

 {loading?<p>Loading schedules…</p>:<div className="gp-staff-week-scroll"><table className="gp-staff-week-grid"><thead><tr><th>Employee</th>{days.map(d=><th key={d}>{d}</th>)}</tr></thead><tbody>{employees.filter(e=>(inactive||e.active)&&`${e.firstName} ${e.lastName} ${e.jobTitle||''}`.toLowerCase().includes(query.toLowerCase())).map(e=><tr key={e.id}><th><button className="gp-staff-week-name" title={`Edit employee · ${e.locationId?locations.find(l=>l.id===e.locationId)?.name:"No assigned location / outside marketing"}`} onClick={()=>{setSelected(null);setForm({...blank,...e,jobTitle:e.jobTitle||'',locationId:e.locationId||'',pin:''})}}>{e.firstName} {e.lastName}<small>{e.jobTitle||e.role}{!e.active?' · Inactive':''}</small></button></th>{days.map((d,day)=>{const s=shifts.find(s=>s.userId===e.id&&Number(s.dayOfWeek)===day&&s.active);return <td key={d}><button className={`gp-shift ${s?'working':'off'}`} aria-label={`${e.firstName} ${e.lastName}, ${d}: ${s?`${clock(s.startTime)} to ${clock(s.endTime)}`:'Off / no recurring hours'}`} onClick={()=>{setForm(null);setSelected({employee:e,day,id:s?.id,start:s?.startTime||'08:30',end:s?.endTime||'17:00'})}}>{s?<>{clock(s.startTime)}<br/>{clock(s.endTime)}</>:<>Off<small>No recurring hours</small></>}</button></td>})}</tr>)}</tbody></table></div>}</section>

}

