"use client";
import {usePetVisibility} from './use-pet-visibility';
import {useModuleRefresh} from "./module-view";
import {employeeFetch} from "../lib/employee-fetch";
import {useEffect,useState,useRef} from 'react';
import {CustomerProfile} from './customer-profile';
import {PetRecord} from './pet-editor';
type OwnedPet=PetRecord&{customer:{id:string;firstName:string;lastName:string}};
export function PetsWorkspace(){
 const {showInactive,setShowInactive}=usePetVisibility();
 const {visible,revision:moduleRevision}=useModuleRefresh(['/api/pets','/api/customers']);const loaded=useRef(false);
 const[q,setQ]=useState(''),[pets,setPets]=useState<OwnedPet[]>([]),[selected,setSelected]=useState<OwnedPet|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!visible)return;const controller=new AbortController();setLoading(!loaded.current);const timer=setTimeout(async()=>{try{const r=await employeeFetch(`/api/pets?q=${encodeURIComponent(q)}&showInactive=${showInactive}`,{signal:controller.signal,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load pets.');if(controller.signal.aborted)return;loaded.current=true;setPets(d.pets);setError('')}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load pets.')}finally{if(!controller.signal.aborted)setLoading(false)}},200);return()=>{clearTimeout(timer);controller.abort()}},[q,revision,visible,moduleRevision,showInactive]);
 return <section className="gp-calendar" style={{padding:24}}><h1 className="gp-title">Pets</h1><p>Click a pet to edit its record. Its owner stays linked.</p><label><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Show Inactive</label><input className="gp-search-input" aria-label="Search pets" placeholder="Search pet, breed, or owner" value={q} onChange={e=>setQ(e.target.value)}/>{loading?<p>Loading pets…</p>:error?<p role="alert">{error}</p>:pets.length?pets.map(p=><button key={p.id} className="gp-customer-result" onClick={()=>setSelected(p)}><div><strong>{p.name}{p.active===false?" · Inactive":""}</strong><span>{p.breed||'Breed not set'}</span><span>Owner: {p.customer.firstName} {p.customer.lastName}</span></div><b>Edit pet</b></button>):<p>No pets found. Add a pet from its customer’s account.</p>}{pets.length===100&&<p>Showing the first 100 matches. Search to narrow the list.</p>}{selected&&<CustomerProfile customerId={selected.customerId} initialPetId={selected.id} onClose={()=>{setSelected(null);setRevision(v=>v+1)}}/>}</section>
}
