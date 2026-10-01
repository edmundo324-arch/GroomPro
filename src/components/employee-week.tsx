"use client";

import {useEffect,useState} from "react";

import {ScheduleBoard} from "./schedule-board";
import {EmployeeEditor} from "./employee-editor";
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

 return <section><div className="gp-staff-week-toolbar"><h2>Employee schedules</h2><button className="gp-btn primary" onClick={()=>setForm({...blank})}>+ Add Employee</button></div>{message&&<p role="status">{message}</p>}{form&&<EmployeeEditor key={form.id||'new'} initial={form} locations={locations} busy={busy} onSave={f=>save('/api/employees',f.id?'PATCH':'POST',f)} onCancel={()=>setForm(null)}/>} {loading?<p>Loading employees…</p>:<ScheduleBoard kind="employee" resources={employees.map(e=>({id:e.id,name:`${e.firstName} ${e.lastName}`,detail:e.jobTitle||e.role,active:e.active,slots:shifts.filter(s=>s.userId===e.id)}))} onReload={load} onEdit={id=>{const e=employees.find(e=>e.id===id)!;setForm({...blank,...e,jobTitle:e.jobTitle||'',locationId:e.locationId||'',pin:''})}}/>}</section>
}
