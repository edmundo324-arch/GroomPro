"use client";
import { useEffect, useMemo, useState } from "react";

type Employee = { id:string; firstName:string; lastName:string; role:string; active?:boolean };
type PetRow = { petId:string; pet:{ id:string; name:string; breed:string|null }; vipAvailability:"AVAILABLE"|"NOT_AVAILABLE"|"NEEDS_MORE_SESSIONS"|null; analSituation:"DONE_REQUESTED"|"DONE_NOT_REQUESTED"|"NOT_NEEDED"|null };
type Line = { role:string; assignedUser:{id:string;firstName:string;lastName:string}|null; pet:{id:string;name:string}|null; description:string };
type Ticket = { id:string; orderNumber:number; scheduledStart:string|null; status:string; arrivalPriority:number|null; daycareStatus:"NONE"|"STAYING"; pets:PetRow[]; lines:Line[] };

function initials(e:{firstName:string;lastName:string}|null){return e?`${e.firstName} ${e.lastName.charAt(0)}.`:"—"}
function vipIcon(status:PetRow["vipAvailability"]){if(status==="AVAILABLE")return "💙";if(status==="NOT_AVAILABLE")return "❌";if(status==="NEEDS_MORE_SESSIONS")return "💙💙💙";return ""}
function timeLabel(value:string|null){return value?new Date(value).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):""}

export function Whiteboard({date=new Date()}:{date?:Date}){
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const dateKey=useMemo(()=>{const d=new Date(date);const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`},[date]);
  async function load(){setLoading(true);setError("");try{const [a,b]=await Promise.all([fetch(`/api/whiteboard?date=${dateKey}`),fetch("/api/employees")]);if(!a.ok)throw new Error("Whiteboard data could not be loaded.");const ad=await a.json();const bd=b.ok?await b.json():{employees:[]};setTickets(ad.tickets||[]);setEmployees(bd.employees||[])}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  useEffect(()=>{load();const timer=window.setInterval(load,30000);return()=>window.clearInterval(timer)},[dateKey]);
  async function patch(payload:Record<string,unknown>){const r=await fetch("/api/whiteboard",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Whiteboard update failed.")}await load()}
  const sorted=[...tickets].sort((a,b)=>{if(a.scheduledStart&&b.scheduledStart)return new Date(a.scheduledStart).getTime()-new Date(b.scheduledStart).getTime();return a.orderNumber-b.orderNumber});
  return <div style={{height:"100%",width:"100%",background:"#dff2f4",fontFamily:"Arial,sans-serif",overflow:"auto",touchAction:"manipulation"}}>
    <div style={{position:"sticky",top:0,zIndex:5,background:"#4b55c7",color:"white",display:"grid",gridTemplateColumns:"90px 80px minmax(150px,1.2fr) minmax(130px,1fr) 130px 150px 150px 150px 145px 110px 110px",alignItems:"center",fontWeight:800,fontSize:18,padding:"12px 8px",gap:4}}>
      {['SCH TIME','ORDER #','NAME','BREED','FW / GR / VIP','PREPARED BY','WASHED BY','GROOMED BY','DONE?','DAYCARE','PICKED UP?'].map(h=><div key={h} style={{textAlign:"center",lineHeight:1.05}}>{h}</div>)}
    </div>
    {loading?<div style={{padding:40,textAlign:"center",fontSize:28}}>Loading Whiteboard…</div>:error?<div style={{padding:40,textAlign:"center",fontSize:24}}>{error}</div>:sorted.map((t,index)=>{
      const names=t.pets.map(p=>p.pet.name).join(" + ");
      const breeds=t.pets.map(p=>p.pet.breed||"—").join(" + ");
      const pkg=t.pets.map(p=>vipIcon(p.vipAvailability)).filter(Boolean).join(" ");
      const prep=t.lines.find(l=>l.role==="PREP")?.assignedUser||null;
      const bath=t.lines.find(l=>l.role==="BATH")?.assignedUser||null;
      const groom=t.lines.find(l=>l.role==="GROOM")?.assignedUser||null;
      const options=[null,...Array.from({length:Math.max(12,sorted.length)},(_,i)=>i+1)];
      return <div key={t.id} style={{display:"grid",gridTemplateColumns:"90px 80px minmax(150px,1.2fr) minmax(130px,1fr) 130px 150px 150px 150px 145px 110px 110px",alignItems:"center",minHeight:58,padding:"2px 8px",gap:4,background:index%2===0?"rgba(255,255,255,.28)":"rgba(255,255,255,.08)",fontSize:20}}>
        <div style={{textAlign:"center",fontWeight:700}}>{timeLabel(t.scheduledStart)}</div>
        <div style={{textAlign:"center"}}><select value={t.arrivalPriority??""} onChange={e=>patch({ticketId:t.id,action:"PRIORITY",value:e.target.value?Number(e.target.value):null})} style={{fontSize:20,fontWeight:800,width:72,minHeight:42,textAlign:"center",background:"transparent"}}><option value="">—</option>{options.slice(1).map(n=><option key={n} value={n}>{n}</option>)}</select></div>
        <div style={{fontWeight:800,textAlign:"center"}}>{names}</div>
        <div style={{textAlign:"center",fontSize:16}}>{breeds}</div>
        <div style={{textAlign:"center",fontWeight:800}}>{pkg||""}</div>
        <div style={{textAlign:"center"}}>{initials(prep)}</div>
        <div style={{textAlign:"center"}}>{initials(bath)}</div>
        <div style={{textAlign:"center"}}>{initials(groom)}</div>
        <div style={{textAlign:"center",fontSize:26}}>{t.status==="READY"?"💙":""}</div>
        <div style={{textAlign:"center",fontSize:28}}>{t.daycareStatus==="STAYING"?"🐾":""}</div>
        <div style={{textAlign:"center",fontSize:24}}>{t.status==="CLOSED"?"✓":""}</div>
      </div>})}
    <div style={{position:"sticky",bottom:0,padding:"10px 16px",background:"#4b55c7",color:"white",fontWeight:700,fontSize:16,textAlign:"center"}}>Touch controls are intentional: schedule order stays stable; arrival priority is selected from the dropdown. 🐾 Daycare is ticket-level and applies to every dog on that ticket.</div>
  </div>
}
