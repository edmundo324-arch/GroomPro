"use client";
import {usePetVisibility} from './use-pet-visibility';
import {useModuleRefresh} from "./module-view";
import {employeeFetch} from "../lib/employee-fetch";
import {useEffect,useState,useRef} from 'react';
import {CustomerProfile} from './customer-profile';
import {PetRecord} from './pet-editor';
import {ProfileDisplayPreferences,ProfileDisplayTable,profileScalar} from './profile-display-table';
import {petColumns,petDefaultColumns,type ProfileColumn} from '../lib/profile-display-fields';
type OwnedPet=PetRecord&Record<string,unknown>&{customer:{id:string;firstName:string;lastName:string}};
function petCell(pet:OwnedPet,column:ProfileColumn){
 if(column.key==='name')return <strong>{pet.name}{pet.active===false?' · Inactive':''}</strong>;
 if(column.key==='customer')return [pet.customer?.firstName,pet.customer?.lastName].filter(Boolean).join(' ')||'—';
 if(column.key==='vaccinations')return Array.isArray(pet.vaccinations)?pet.vaccinations.map(v=>[v.vaccineName,v.expiresAt&&new Date(v.expiresAt).toLocaleDateString()].filter(Boolean).join(' · ')).join(', ')||'—':'—';
 return profileScalar(pet[column.key],column);
}

export function PetsWorkspace(){
 const [displayFields,setDisplayFields]=useState(petDefaultColumns),[displayOptions,setDisplayOptions]=useState(petColumns),[limit,setLimit]=useState('50');
 const {showInactive,setShowInactive}=usePetVisibility();
 const {visible,revision:moduleRevision}=useModuleRefresh(['/api/pets','/api/customers']);const loaded=useRef(false);
 const[q,setQ]=useState(''),[pets,setPets]=useState<OwnedPet[]>([]),[selected,setSelected]=useState<OwnedPet|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!visible)return;const controller=new AbortController();setLoading(!loaded.current);const timer=setTimeout(async()=>{try{const r=await employeeFetch(`/api/pets?q=${encodeURIComponent(q)}&showInactive=${showInactive}&limit=${limit}`,{signal:controller.signal,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load pets.');if(controller.signal.aborted)return;loaded.current=true;setPets(d.pets);setError('')}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load pets.')}finally{if(!controller.signal.aborted)setLoading(false)}},200);return()=>{clearTimeout(timer);controller.abort()}},[q,revision,visible,moduleRevision,showInactive,limit]);
 return <section className="gp-calendar gp-customers-workspace"><div className="gp-calendar-head" style={{padding:24}}><div><h1 className="gp-title">Pets</h1><p className="gp-subtitle">Find a pet by name, breed, or owner.</p></div><ProfileDisplayPreferences endpoint="/api/pet-display" title="Pet display fields" fields={displayFields} options={displayOptions} onChange={(fields,options)=>{setDisplayFields(fields);setDisplayOptions(options)}}/><label>Pets to display <select value={limit} onChange={e=>setLimit(e.target.value)}>{['50','100','200','all'].map(size=><option key={size} value={size}>{size==='all'?'All':size}</option>)}</select></label><label><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Show Inactive</label></div><div style={{padding:"0 24px 24px"}}><input className="gp-search-input" aria-label="Search pets" placeholder="Search pet, breed, or owner" value={q} onChange={e=>setQ(e.target.value)}/>{loading?<p>Loading pets…</p>:error?<p role="alert">{error}</p>:pets.length?<ProfileDisplayTable label="Pets" rows={pets} fields={displayFields} options={displayOptions} name={pet=>pet.name} render={petCell} onOpen={setSelected}/>:<p>No pets found. Add a pet from its customer’s account.</p>}</div>{selected&&<CustomerProfile customerId={selected.customerId} initialPetId={selected.id} onClose={()=>{setSelected(null);setRevision(v=>v+1)}}/>}</section>
}
