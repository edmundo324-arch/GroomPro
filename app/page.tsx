"use client";
import {visibleModules,FeatureSetting} from "../src/lib/module-navigation";
import {useEffect,useState} from "react";
import {StaffAvailabilitySettings} from "../src/components/staff-availability-settings";
import {CatalogWorkspace} from "../src/components/catalog-workspace";
import {requestEmployeePin} from "../src/lib/employee-fetch";
import {ActionPin} from "../src/components/action-pin";
import {CalendarWorkspace} from "../src/components/calendar-workspace";
import {CustomersWorkspace} from "../src/components/customers-workspace";
import {CustomerCreateWindow} from "../src/components/customer-create-window";
import {CustomerProfile} from "../src/components/customer-profile";
import {PosTicketWindow} from "../src/components/pos-ticket-window";
import {TicketsWorkspace} from "../src/components/tickets-workspace";
import {Whiteboard} from "../src/components/whiteboard";
import {Settings} from "../src/components/settings";
import {ModuleWorkspace} from "../src/components/module-workspaces";
const modules=["Calendar","Customers","Pets","Tickets","Whiteboard","Messaging","Inventory","Reports","Services","Products","Packages","VIP Memberships","Schedule","Settings"] as const;
type Module=typeof modules[number];
type Employee={id:string;firstName:string;lastName:string;role:string;active:boolean};
export default function Home(){
 const[posTicket,setPosTicket]=useState<{ticketId?:string;date:Date;customerId?:string;key:number}|null>(null);
 const[calendarRevision,setCalendarRevision]=useState(0);
 const[contextReady,setContextReady]=useState(false),[contextError,setContextError]=useState("");
 const[active,setActive]=useState<Module>("Calendar"),[employee,setEmployee]=useState<Employee|null>(null),[customer,setCustomer]=useState<string|null>(null),[createCustomer,setCreateCustomer]=useState(false),[features,setFeatures]=useState<FeatureSetting[]>([]);
 useEffect(()=>{let cancelled=false;async function initialize(){try{const r=await fetch("/api/setup/context",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Business setup could not be checked.");if(d.setupRequired){window.location.replace("/setup");return}if(cancelled)return;setContextReady(true);fetch("/api/employee/session").then(r=>r.ok?r.json():{employee:null}).then(d=>setEmployee(d.employee||null)).catch(()=>{});fetch("/api/features").then(r=>r.ok?r.json():{features:[]}).then(d=>{setFeatures(d.features||[])}).catch(()=>{});}catch(e){if(!cancelled)setContextError(e instanceof Error?e.message:"Business setup could not be checked.")}}initialize();return()=>{cancelled=true}},[]);
 const openTicket=(id?:string,date=new Date(),customerId?:string)=>{setCustomer(null);setPosTicket(previous=>({ticketId:id,date,customerId,key:(previous?.key||0)+1}))};const newForCustomer=(id:string)=>openTicket(undefined,new Date(),id);
 useEffect(()=>{const handler=(event:Event)=>{const d=(event as CustomEvent).detail||{};openTicket(d.ticketId,new Date(),d.customerId)};window.addEventListener("groompro:open-ticket",handler);return()=>window.removeEventListener("groompro:open-ticket",handler)},[]);
 const closeTicket=()=>{setPosTicket(null);setCalendarRevision(v=>v+1)};
 const allowed=visibleModules(modules,features);
 if(!contextReady)return <main style={{padding:32}}><h1>GroomPro Suite</h1><p>{contextError||"Opening your business…"}</p>{contextError&&<a href="/setup">Open setup</a>}</main>;
 return <div className="gp-shell"><header className="gp-topbar"><div className="gp-brand">GroomPro Suite</div><nav className="gp-module-nav">{allowed.map(m=><button key={m} className={`gp-module ${active===m?"active":""}`} onClick={()=>setActive(m)}>{m}</button>)}</nav><div className="gp-employee"><span className="gp-status-dot"/><span>{employee?`${employee.firstName} ${employee.lastName}`:"Ready"}</span><button className="gp-switch" onClick={()=>void requestEmployeePin(employee?'SWITCH':'SIGN_IN')}>{employee?"Switch":"Employee PIN"}</button></div></header><main className="gp-main">
 {(["Services","Products","Packages","VIP Memberships"] as string[]).includes(active)&&<CatalogWorkspace key={active} kind={active==="Services"?"services":active==="Products"?"products":active==="Packages"?"packages":"plans"}/>} {active==="Calendar"&&<CalendarWorkspace refreshKey={calendarRevision} onNewTicket={date=>openTicket(undefined,date)} onOpenTicket={id=>openTicket(id)}/>} {active==="Customers"&&<CustomersWorkspace onCreateTicket={newForCustomer}/>} {active==="Tickets"&&<TicketsWorkspace refreshKey={calendarRevision} date={new Date()} onOpenTicket={id=>openTicket(id)} onNewTicket={()=>openTicket()}/>} {active==="Whiteboard"&&<section style={{height:"calc(100vh - 140px)",minHeight:400,background:"var(--gp-secondary)"}}><Whiteboard date={new Date()}/></section>} {active==="Schedule"&&<section className="gp-settings"><h1 className="gp-title">Schedule</h1><StaffAvailabilitySettings/></section>}{active==="Settings"&&<Settings/>} {(active==="Pets"||active==="Messaging"||active==="Inventory"||active==="Reports")&&<ModuleWorkspace module={active} onOpenCustomer={id=>setCustomer(id)} onNewTicket={()=>openTicket()}/>} </main><ActionPin onSignedIn={setEmployee}/>
 {posTicket&&<PosTicketWindow key={posTicket.key} ticketId={posTicket.ticketId} date={posTicket.date} initialCustomerId={posTicket.customerId} onClose={closeTicket} onSaved={()=>setCalendarRevision(v=>v+1)}/>} {createCustomer&&<CustomerCreateWindow onClose={()=>setCreateCustomer(false)} onCreated={id=>{setCreateCustomer(false);setCustomer(id)}} onOpenExisting={id=>{setCreateCustomer(false);setCustomer(id)}}/>}{customer&&<CustomerProfile customerId={customer} onClose={()=>setCustomer(null)} onNewAppointment={newForCustomer} onCreateTicket={newForCustomer}/>}
 </div>;
}


