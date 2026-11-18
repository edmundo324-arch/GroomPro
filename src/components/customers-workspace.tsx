"use client";
import {CustomerIdentification,identificationFields} from "./customer-identification";
import {ProfileDisplayPreferences,ProfileDisplayTable,profileScalar} from './profile-display-table';
import {customerColumns,customerDefaultColumns,type ProfileColumn} from '../lib/profile-display-fields';
import {employeeFetch} from "../lib/employee-fetch";
import { useEffect, useState } from "react";
import {CustomerAgreementTools} from './customer-agreement-tools';
import { CustomerProfile } from "@/src/components/customer-profile";
import { CustomerCreateWindow } from "@/src/components/customer-create-window";
import {useModuleRefresh} from './module-view';

type CustomerResult=Record<string,unknown>&{id:string;firstName:string;lastName:string;email:string|null;phones:{number:string;isPrimary:boolean}[];pets:{name:string}[]};

function customerCell(customer:CustomerResult,column:ProfileColumn){
 if(column.key==='address')return [customer.address1,customer.address2,customer.city,customer.state,customer.postalCode].filter(Boolean).join(', ')||'—';
 if((identificationFields as readonly string[]).includes(column.key))return <CustomerIdentification customer={customer} fields={[column.key]} showPetLabel={false}/>;
 return profileScalar(customer[column.key],column);
}

export function CustomersWorkspace({onCreateTicket}:{onCreateTicket:(customerId:string)=>void}){
 const {visible,revision}=useModuleRefresh(['/api/customers','/api/pets']);
 const[displayFields,setDisplayFields]=useState(customerDefaultColumns),[displayOptions,setDisplayOptions]=useState(customerColumns);
 const[query,setQuery]=useState("");const[results,setResults]=useState<CustomerResult[]>([]);const[selectedId,setSelectedId]=useState<string|null>(null);const[showCreate,setShowCreate]=useState(false);const[searching,setSearching]=useState(false);
 const [limit,setLimit]=useState("50");
 const [listError,setListError]=useState("");
 const searchQuery=query.trim().length>=2 ? query.trim() : "";

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
 return <><section className="gp-calendar gp-customers-workspace"><div className="gp-calendar-head" style={{padding:24}}><div><div className="gp-customer-intake-heading"><h1 className="gp-title">Customers</h1><CustomerAgreementTools/></div><p className="gp-subtitle">Find a client by phone, name, email, or pet name.</p></div><ProfileDisplayPreferences endpoint="/api/customer-display" title="Customer display fields" fields={displayFields} options={displayOptions} onChange={(fields,options)=>{setDisplayFields(fields);setDisplayOptions(options)}}/><label>Customers to display{" "}<select value={limit} onChange={e=>setLimit(e.target.value)}>{["50","100","200","all"].map(size=><option key={size} value={size}>{size==="all"?"All":size}</option>)}</select></label><div className="gp-actions"><button className="gp-btn primary" onClick={()=>setShowCreate(true)}>+ New Customer</button></div></div><div style={{padding:"0 24px 24px"}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Phone, customer name, email, or pet" className="gp-search-input"/>{listError&&<div className="gp-search-empty" role="alert">{listError}</div>}<ProfileDisplayTable label={searchQuery?"Matching customers":"Customers"} rows={results} fields={displayFields} options={displayOptions} busy={searching} name={customer=>customer.firstName+" "+customer.lastName} render={customerCell} onOpen={customer=>setSelectedId(customer.id)}/>{!searching&&!results.length&&!listError&&<div className="gp-search-empty">{searchQuery?"No matching customers found.":"No customers to display."}</div>}</div></section>{selectedId&&<><CustomerProfile customerId={selectedId} onClose={()=>setSelectedId(null)} onNewAppointment={id=>{setSelectedId(null);onCreateTicket(id)}} onCreateTicket={id=>{setSelectedId(null);onCreateTicket(id)}}/></>}{showCreate&&<CustomerCreateWindow onClose={()=>setShowCreate(false)}/>}</>}
