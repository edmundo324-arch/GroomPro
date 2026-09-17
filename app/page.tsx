"use client";
import {visibleModules,FeatureSetting} from "../src/lib/module-navigation";
import {useEffect,useState} from "react";
import {StaffAvailabilitySettings} from "../src/components/staff-availability-settings";
import {CatalogWorkspace} from "../src/components/catalog-workspace";
import {ActionPin} from "../src/components/action-pin";
import {CalendarWorkspace} from "../src/components/calendar-workspace";
import {CustomersWorkspace} from "../src/components/customers-workspace";
import {CustomerCreateWindow} from "../src/components/customer-create-window";
import {CustomerProfile} from "../src/components/customer-profile";
import {TicketWindow} from "../src/components/ticket-window";
import {TicketDetailWindow} from "../src/components/ticket-detail-window";
import {TicketsWorkspace} from "../src/components/tickets-workspace";
import {Whiteboard} from "../src/components/whiteboard";
import {Settings} from "../src/components/settings";
import {ModuleWorkspace} from "../src/components/module-workspaces";
const modules=["Calendar","Customers","Pets","Tickets","Whiteboard","Messaging","Inventory","Reports","Services","Products","Packages","VIP Memberships","Schedule","Settings"] as const;
type Module=typeof modules[number];
type Employee={id:string;firstName:string;lastName:string;role:string;active:boolean};
export default function Home(){
 const[ticketDate,setTicketDate]=useState(()=>new Date());
 const[calendarRevision,setCalendarRevision]=useState(0);
 const[contextReady,setContextReady]=useState(false),[contextError,setContextError]=useState("");
 const[active,setActive]=useState<Module>("Calendar"),[employee,setEmployee]=useState<Employee|null>(null),[showPin,setShowPin]=useState(false),[pin,setPin]=useState(""),[pinError,setPinError]=useState(""),[showTicket,setShowTicket]=useState(false),[ticketCustomer,setTicketCustomer]=useState<string|null>(null),[selectedTicket,setSelectedTicket]=useState<string|null>(null),[customer,setCustomer]=useState<string|null>(null),[createCustomer,setCreateCustomer]=useState(false),[features,setFeatures]=useState<FeatureSetting[]>([]);
 useEffect(()=>{let cancelled=false;async function initialize(){try{const r=await fetch("/api/setup/context",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Business setup could not be checked.");if(d.setupRequired){window.location.replace("/setup");return}if(cancelled)return;setContextReady(true);fetch("/api/employee/session").then(r=>r.ok?r.json():{employee:null}).then(d=>setEmployee(d.employee||null)).catch(()=>{});fetch("/api/features").then(r=>r.ok?r.json():{features:[]}).then(d=>{setFeatures(d.features||[])}).catch(()=>{});}catch(e){if(!cancelled)setContextError(e instanceof Error?e.message:"Business setup could not be checked.")}}initialize();return()=>{cancelled=true}},[]);
 const openTicket=(id?:string,date=new Date())=>{if(id)setSelectedTicket(id);else{setTicketDate(date);setTicketCustomer(null);setShowTicket(true)}};const newForCustomer=(id:string)=>{setTicketDate(new Date());setTicketCustomer(id);setCustomer(null);setShowTicket(true)};
 async function enterPin(){if(!/^\d{4,10}$/.test(pin)){setPinError("Enter a 4–10 digit PIN.");return}setPinError("");try{const r=await fetch("/api/employee/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})});const d=await r.json();if(!r.ok){setPinError(d.error||"Employee PIN was not recognized.");return}setEmployee(d.employee);setPin("");setShowPin(false)}catch{setPinError("Employee sign-in could not be completed.")}}
 async function switchEmployee(){await fetch("/api/employee/session",{method:"DELETE"}).catch(()=>{});setEmployee(null);setPin("");setShowPin(true)}
 const allowed=visibleModules(modules,features);
 if(!contextReady)return <main style={{padding:32}}><h1>GroomPro Suite</h1><p>{contextError||"Opening your business…"}</p>{contextError&&<a href="/setup">Open setup</a>}</main>;
 return <div className="gp-shell"><header className="gp-topbar"><div className="gp-brand">GroomPro Suite</div><nav className="gp-module-nav">{allowed.map(m=><button key={m} className={`gp-module ${active===m?"active":""}`} onClick={()=>setActive(m)}>{m}</button>)}</nav><div className="gp-employee"><span className="gp-status-dot"/><span>{employee?`${employee.firstName} ${employee.lastName}`:"Ready"}</span><button className="gp-switch" onClick={()=>employee?switchEmployee():setShowPin(true)}>{employee?"Switch":"Employee PIN"}</button></div></header><main className="gp-main">
 {(["Services","Products","Packages","VIP Memberships"] as string[]).includes(active)&&<CatalogWorkspace key={active} kind={active==="Services"?"services":active==="Products"?"products":active==="Packages"?"packages":"plans"}/>} {active==="Calendar"&&<CalendarWorkspace refreshKey={calendarRevision} onNewTicket={date=>openTicket(undefined,date)} onOpenTicket={id=>setSelectedTicket(id)}/>} {active==="Customers"&&<CustomersWorkspace onCreateTicket={newForCustomer}/>} {active==="Tickets"&&<TicketsWorkspace date={new Date()} onOpenTicket={id=>setSelectedTicket(id)} onNewTicket={()=>openTicket()}/>} {active==="Whiteboard"&&<section style={{height:"calc(100vh - 140px)",minHeight:400,background:"var(--gp-secondary)"}}><Whiteboard date={new Date()}/></section>} {active==="Schedule"&&<section className="gp-settings"><h1 className="gp-title">Schedule</h1><StaffAvailabilitySettings/></section>}{active==="Settings"&&<Settings/>} {(active==="Pets"||active==="Messaging"||active==="Inventory"||active==="Reports")&&<ModuleWorkspace module={active} onOpenCustomer={id=>setCustomer(id)} onNewTicket={()=>openTicket()}/>} </main><ActionPin onSignedIn={setEmployee}/>
 {showTicket&&<TicketWindow date={ticketDate} initialCustomerId={ticketCustomer} onClose={()=>{setShowTicket(false);setTicketCustomer(null)}} onSaved={()=>{setShowTicket(false);setTicketCustomer(null);setCalendarRevision(v=>v+1)}}/>}{selectedTicket&&<TicketDetailWindow ticketId={selectedTicket} onClose={()=>{setSelectedTicket(null);setCalendarRevision(v=>v+1)}}/>} {createCustomer&&<CustomerCreateWindow onClose={()=>setCreateCustomer(false)} onCreated={id=>{setCreateCustomer(false);setCustomer(id)}} onOpenExisting={id=>{setCreateCustomer(false);setCustomer(id)}}/>}{customer&&<CustomerProfile customerId={customer} onClose={()=>setCustomer(null)} onNewAppointment={newForCustomer} onCreateTicket={newForCustomer}/>} {showPin&&<div className="gp-modal-backdrop"><div className="gp-pin-window"><h2>Employee PIN</h2><p className="gp-floating-subtitle">Enter the employee PIN for an accountable action.</p><input autoFocus inputMode="numeric" type="password" maxLength={10} value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,"").slice(0,10));setPinError("")}} onKeyDown={e=>e.key==="Enter"&&enterPin()} placeholder="4–10 digit PIN" className="gp-search-input"/>{pinError&&<div className="gp-form-error">{pinError}</div>}<div className="gp-modal-actions"><button className="gp-btn" onClick={()=>setShowPin(false)}>Cancel</button><button className="gp-btn primary" onClick={enterPin}>Continue</button></div></div></div>}
 </div>;
}


