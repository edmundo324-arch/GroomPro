"use client";
import {CustomerIdentification,CustomerDisplayPreferences,customerFieldLabels} from "./customer-identification";
import {employeeFetch} from "../lib/employee-fetch";
import { useEffect, useState } from "react";
import { CustomerProfile } from "@/src/components/customer-profile";
import { CustomerCreateWindow } from "@/src/components/customer-create-window";
import {useModuleRefresh} from './module-view';

type CustomerResult={id:string;firstName:string;lastName:string;email:string|null;phones:{number:string;isPrimary:boolean}[];pets:{name:string}[]};
type LocationAccess={id:string;name:string;assigned:boolean};

export function CustomersWorkspace({onCreateTicket}:{onCreateTicket:(customerId:string)=>void}){
 const {visible,revision}=useModuleRefresh(['/api/customers','/api/pets']);
 const[displayFields,setDisplayFields]=useState<string[]>(["name","email","phones","pets"]);
 const[query,setQuery]=useState("");const[results,setResults]=useState<CustomerResult[]>([]);const[selectedId,setSelectedId]=useState<string|null>(null);const[showCreate,setShowCreate]=useState(false);const[searching,setSearching]=useState(false);const[locations,setLocations]=useState<LocationAccess[]>([]);const[accessOpen,setAccessOpen]=useState(false);const[accessSaving,setAccessSaving]=useState(false);const[accessError,setAccessError]=useState("");
 const [limit,setLimit]=useState("50");
 const [listError,setListError]=useState("");
 const searchQuery=query.trim().length>=2 ? query.trim() : "";
 const columns=displayFields.length?displayFields:["name"];
 const profileColumn=columns.includes("name")?"name":columns[0];
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController();
  setSearching(true);
  setListError("");
  const timer=window.setTimeout(async()=>{
   try{
    const params=new URLSearchParams({q:searchQuery,limit});
    const response=await employeeFetch(`/api/customers/search?${params}`,{signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Customers could not load.");
    if(!controller.signal.aborted)setResults(data.customers||[]);
   }catch(error){
    if(!controller.signal.aborted){
     setResults([]);
     setListError(error instanceof Error?error.message:"Customers could not load.");
    }
   }finally{
    if(!controller.signal.aborted)setSearching(false);
   }
  },searchQuery?200:0);
  return()=>{clearTimeout(timer);controller.abort()};
 },[searchQuery,limit,selectedId,showCreate,visible,revision]);
 async function openAccess(){if(!selectedId)return;setAccessOpen(true);setAccessError("");try{const r=await employeeFetch(`/api/customers/location-access?customerId=${encodeURIComponent(selectedId)}`);const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load locations.");setLocations(d.locations||[])}catch(e){setAccessError(e instanceof Error?e.message:"Unable to load locations.")}}
 async function saveAccess(){if(!selectedId)return;setAccessSaving(true);setAccessError("");try{const r=await employeeFetch("/api/customers/location-access",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerId:selectedId,locationIds:locations.filter(l=>l.assigned).map(l=>l.id)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save location access.");setAccessOpen(false)}catch(e){setAccessError(e instanceof Error?e.message:"Unable to save location access.")}finally{setAccessSaving(false)}}
 return <><section className="gp-calendar gp-customers-workspace"><div className="gp-calendar-head" style={{padding:24}}><div><h1 className="gp-title">Customers</h1><p className="gp-subtitle">Find a client by phone, name, email, or pet name.</p></div><CustomerDisplayPreferences onChange={setDisplayFields}/><label>Customers to display{" "}<select value={limit} onChange={e=>setLimit(e.target.value)}>{["50","100","200","all"].map(size=><option key={size} value={size}>{size==="all"?"All":size}</option>)}</select></label><div className="gp-actions"><button className="gp-btn primary" onClick={()=>setShowCreate(true)}>+ New Customer</button></div></div><div style={{padding:"0 24px 24px"}}><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Phone, customer name, email, or pet" className="gp-search-input"/>{listError?<div className="gp-search-empty" role="alert">{listError}</div>:searching&&!results.length?<div className="gp-search-empty" role="status">Loading customers…</div>:results.length?<div className="gp-search-results gp-customer-table">
 <table aria-label={searchQuery?"Matching customers":"Customers"} aria-busy={searching}>
  <thead><tr>{columns.map(field=><th key={field} scope="col">{customerFieldLabels[field]||field}</th>)}</tr></thead>
  <tbody>{results.map(customer=><tr key={customer.id} onClick={()=>setSelectedId(customer.id)}>
   {columns.map(field=>{
    const value=<CustomerIdentification customer={customer} fields={[field]} showPetLabel={false}/>;
    return <td key={field}>{field===profileColumn?<button type="button" className="gp-customer-row-link" aria-label={'View '+customer.firstName+' '+customer.lastName}>{value}</button>:value}</td>;
   })}
  </tr>)}</tbody>
 </table>
</div>:<div className="gp-search-empty">{searchQuery?"No matching customers found.":"No customers to display."}</div>}</div></section>{selectedId&&<><CustomerProfile customerId={selectedId} onClose={()=>setSelectedId(null)} onNewAppointment={id=>{setSelectedId(null);setAccessOpen(false);onCreateTicket(id)}} onCreateTicket={id=>{setSelectedId(null);setAccessOpen(false);onCreateTicket(id)}}/><div className="gp-floating-window" style={{position:"fixed",right:24,bottom:24,zIndex:20,padding:12}}><button className="gp-btn" onClick={openAccess}>Location Access</button></div></>}{showCreate&&<CustomerCreateWindow onClose={()=>setShowCreate(false)}/>}{accessOpen&&<div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-pin-window"><h2 style={{marginTop:0}}>Customer Location Access</h2><p className="gp-floating-subtitle">Choose which business locations can access this customer when Customer Sharing is set to selected locations.</p>{locations.map(l=><label key={l.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 0"}}><input type="checkbox" checked={l.assigned} onChange={e=>setLocations(x=>x.map(v=>v.id===l.id?{...v,assigned:e.target.checked}:v))}/><span>{l.name}</span></label>)}{!locations.length&&!accessError&&<div className="gp-search-empty">No locations are configured yet.</div>}{accessError&&<div className="gp-form-error">{accessError}</div>}<div className="gp-modal-actions"><button className="gp-btn" onClick={()=>setAccessOpen(false)}>Cancel</button><button className="gp-btn primary" disabled={accessSaving} onClick={saveAccess}>{accessSaving?"Saving…":"Save Access"}</button></div></div></div>}</>}
