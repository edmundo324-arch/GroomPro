"use client";
import {readySelection} from "../src/lib/ready-selection";
import {ModuleView} from "../src/components/module-view";
import {visibleModules,FeatureSetting} from "../src/lib/module-navigation";
import {useEffect,useState,useRef,useCallback} from "react";
import {StaffAvailabilitySettings} from "../src/components/staff-availability-settings";
import {CatalogWorkspace} from "../src/components/catalog-workspace";
import {requestEmployeePin,clearEmployeeReads} from "../src/lib/employee-fetch";
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
 const [scope,setScope]=useState(''),[employeeScope,setEmployeeScope]=useState('anonymous');const scopeRef=useRef(''),employeeScopeRef=useRef('anonymous');
 const navigationRef=useRef<{key?:number;active:string}>({active:"Calendar"});const ticketSequence=useRef(0),openTicketRef=useRef<(id?:string,date?:Date,customerId?:string)=>void>(()=>{});const[openTickets,setOpenTickets]=useState<{ticketId?:string;date:Date;customerId?:string;employeeId?:string;key:number}[]>([]);
 const ticketSelection=useRef(readySelection<number>());const[openingTicket,setOpeningTicket]=useState(false);
 const[posTicket,setPosTicket]=useState<{ticketId?:string;date:Date;customerId?:string;employeeId?:string;key:number}|null>(null);
 const[calendarRevision,setCalendarRevision]=useState(0);
 const[scheduledCalendarDate,setScheduledCalendarDate]=useState<string>();
 const[whiteboardDate,setWhiteboardDate]=useState<Date>(()=>new Date());
 const[saveError,setSaveError]=useState("");
 useEffect(()=>{const handler=(event:Event)=>setSaveError((event as CustomEvent).detail?.message||"A background save failed.");window.addEventListener("groompro:save-error",handler);return()=>window.removeEventListener("groompro:save-error",handler)},[]);
 const[contextReady,setContextReady]=useState(false),[contextError,setContextError]=useState("");
 const[active,setActive]=useState<Module>("Calendar"),[employee,setEmployee]=useState<Employee|null>(null),[customer,setCustomer]=useState<string|null>(null),[createCustomer,setCreateCustomer]=useState(false),[features,setFeatures]=useState<FeatureSetting[]>([]);
 useEffect(()=>{let cancelled=false;async function initialize(){try{const r=await fetch("/api/setup/context",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Business setup could not be checked.");if(d.setupRequired){window.location.replace("/setup");return}if(cancelled)return;setContextReady(true);fetch("/api/employee/session").then(r=>r.ok?r.json():{employee:null}).then(d=>signedIn(d.employee||null)).catch(()=>{});fetch("/api/features").then(r=>r.ok?r.json():{features:[]}).then(d=>{setFeatures(d.features||[])}).catch(()=>{});}catch(e){if(!cancelled)setContextError(e instanceof Error?e.message:"Business setup could not be checked.")}}initialize();return()=>{cancelled=true}},[]);
 const openTicket=(id?:string,date=new Date(),customerId?:string,employeeId?:string)=>{setCustomer(null);const existing=id?openTickets.find(t=>t.ticketId===id):undefined;const next=existing||{ticketId:id,date,customerId,employeeId,key:++ticketSequence.current};if(!existing)setOpenTickets(t=>[...t,next]);if(ticketSelection.current.select(next.key)){setPosTicket(next);setOpeningTicket(false)}else setOpeningTicket(true)};const newForCustomer=(id:string)=>openTicket(undefined,new Date(),id);
 openTicketRef.current=openTicket;
 useEffect(()=>{const handler=(event:Event)=>{const d=(event as CustomEvent).detail||{};openTicketRef.current(d.ticketId,new Date(),d.customerId)};window.addEventListener("groompro:open-ticket",handler);return()=>window.removeEventListener("groompro:open-ticket",handler)},[]);
 const closeTicket=()=>{setPosTicket(null)};
 const signedIn=useCallback((next:Employee|null)=>{setEmployee(next);if(!next)return;const key=`${next.id}:${next.role}`;if(employeeScopeRef.current!=='anonymous'&&employeeScopeRef.current!==key){clearEmployeeReads();ticketSelection.current.clear();setOpeningTicket(false);setOpenTickets([]);setPosTicket(null);setCustomer(null);setCreateCustomer(false);setEmployeeScope(key)}employeeScopeRef.current=key},[]);
 useEffect(()=>{let cancelled=false;const check=async()=>{try{const r=await fetch('/api/ui-context',{cache:'no-store'});if(!r.ok)return;const d=await r.json(),key=`${d.tenantId}:${d.locationId}`;if(cancelled)return;if(scopeRef.current&&scopeRef.current!==key){clearEmployeeReads();ticketSelection.current.clear();setOpeningTicket(false);setOpenTickets([]);setPosTicket(null);setCustomer(null);setCreateCustomer(false);setScheduledCalendarDate(undefined);setWhiteboardDate(new Date());setSaveError('');setActive('Calendar')}scopeRef.current=key;setScope(key)}catch{}};void check();window.addEventListener('focus',check);window.addEventListener('groompro:context-changed',check);return()=>{cancelled=true;window.removeEventListener('focus',check);window.removeEventListener('groompro:context-changed',check)}},[]);
 navigationRef.current={key:posTicket?.key,active};
 const allowed=visibleModules(modules,features);
 if(!contextReady)return <main style={{padding:32}}><h1>GroomPro Suite</h1><p>{contextError||"Opening your business…"}</p>{contextError&&<a href="/setup">Open setup</a>}</main>;
 return <div className={`gp-shell ${active==="Whiteboard"?"gp-whiteboard-shell":""}`}><header className="gp-topbar"><div className="gp-brand">GroomPro Suite</div><nav className="gp-module-nav">{allowed.map(m=><button key={m} className={`gp-module ${active===m?"active":""}`} onClick={()=>setActive(m)}>{m}</button>)}</nav><div className="gp-employee"><span className="gp-status-dot"/><span>{employee?`${employee.firstName} ${employee.lastName}`:"Ready"}</span><button className="gp-switch" onClick={()=>void requestEmployeePin(employee?'SWITCH':'SIGN_IN')}>{employee?"Switch":"Employee PIN"}</button></div></header><main className="gp-main">{saveError&&<div role="alert" className="gp-form-error">{saveError}<button onClick={()=>setSaveError("")}>Dismiss</button></div>}
 {modules.filter(m=>allowed.includes(m)).map(m=><ModuleView key={`${scope}:${employeeScope}:${m}`} active={active===m}>
 {(["Services","Products","Packages","VIP Memberships"] as string[]).includes(m)&&<CatalogWorkspace kind={m==="Services"?"services":m==="Products"?"products":m==="Packages"?"packages":"plans"}/>}
 {m==="Calendar"&&<CalendarWorkspace onWhiteboardPrepared={date=>setWhiteboardDate(new Date(date+"T12:00:00"))} requestedDate={scheduledCalendarDate} refreshKey={calendarRevision} onNewTicket={(date,employeeId)=>openTicket(undefined,date,undefined,employeeId)} onOpenTicket={id=>openTicket(id)}/>}
 {m==="Customers"&&<CustomersWorkspace onCreateTicket={newForCustomer}/>}
 {m==="Tickets"&&<TicketsWorkspace refreshKey={calendarRevision} date={new Date()} onOpenTicket={id=>openTicket(id)} onNewTicket={()=>openTicket()}/>}
 {m==="Whiteboard"&&<section className="gp-whiteboard-host" style={{height:"calc(100vh - 140px)",minHeight:400,background:"var(--gp-secondary)"}}><Whiteboard date={whiteboardDate}/></section>}
 {m==="Schedule"&&<section className="gp-settings"><h1 className="gp-title">Schedule</h1><StaffAvailabilitySettings/></section>}
 {m==="Settings"&&<Settings/>}
 {(m==="Pets"||m==="Messaging"||m==="Inventory"||m==="Reports")&&<ModuleWorkspace module={m} onOpenCustomer={id=>setCustomer(id)} onNewTicket={()=>openTicket()}/>}
 </ModuleView>)} </main><ActionPin onSignedIn={signedIn}/>
 {openingTicket&&<div className="gp-record-opening" role="status">Opening POS Ticket... <button className="gp-btn" onClick={()=>{ticketSelection.current.cancel();setOpeningTicket(false)}}>Cancel</button></div>}{openTickets.map(editor=><div key={editor.key} hidden={posTicket?.key!==editor.key} style={posTicket?.key===editor.key?{display:'contents'}:{display:'none'}}><PosTicketWindow onReady={()=>{if(ticketSelection.current.resolve(editor.key)){setPosTicket(editor);setOpeningTicket(false)}}} active={posTicket?.key===editor.key} ticketId={editor.ticketId} date={editor.date} initialEmployeeId={editor.employeeId} initialCustomerId={editor.customerId} onClose={()=>{if(navigationRef.current.key===editor.key){ticketSelection.current.cancel();setOpeningTicket(false)}setPosTicket(current=>current?.key===editor.key?null:current)}} onScheduled={date=>{if(navigationRef.current.key===editor.key&&navigationRef.current.active!=="Calendar"){setActive("Calendar")}}} onSaved={id=>{window.dispatchEvent(new CustomEvent('groompro:ticket-changed',{detail:{ticketId:id}}));setOpenTickets(all=>all.map(t=>t.key===editor.key?{...t,ticketId:id}:t));setCalendarRevision(v=>v+1)}}/></div>)} {createCustomer&&<CustomerCreateWindow onClose={()=>setCreateCustomer(false)} onCreated={id=>{setCreateCustomer(false);setCustomer(id)}} onOpenExisting={id=>{setCreateCustomer(false);setCustomer(id)}}/>}{customer&&<CustomerProfile customerId={customer} onClose={()=>setCustomer(null)} onNewAppointment={newForCustomer} onCreateTicket={newForCustomer}/>}
 </div>;
}


