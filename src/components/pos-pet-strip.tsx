"use client";
import {useState} from 'react';
import {PetCare} from './pet-care';
type Props={pets:any[];includedIds:string[];packageIds:string[];disabled:boolean;warnVet:boolean;summaries:Record<string,string>;onInclude:(pet:any,included:boolean)=>void;onPackage:(id:string)=>void;onNotes:()=>void};
export function PosPetStrip({pets,includedIds,packageIds,disabled,warnVet,summaries,onInclude,onPackage,onNotes}:Props){
 const [selected,setSelected]=useState('');
 const pet=pets.find(p=>p.id===selected)||pets[0];
 return <section className="gp-pos-pet-strip" aria-label="Customer pets">
  <div className="gp-pos-pet-row"><span>Pets:</span><div className="gp-pos-pet-scroll" aria-label="Pet choices" tabIndex={0}>
   {pets.length?pets.map(p=><div className="gp-pos-pet-chip" key={p.id} data-selected={pet?.id===p.id} tabIndex={0} onPointerDown={()=>setSelected(p.id)} onFocus={()=>setSelected(p.id)}>
    <button type="button" className="gp-btn" disabled={disabled} aria-pressed={packageIds.includes(p.id)} title="Add or remove this dog’s package" onClick={()=>{setSelected(p.id);onPackage(p.id)}}><span>{p.name}</span><small>{p.weightLbs!=null?`${Number(p.weightLbs)}lb `:''}{p.breed||''}</small></button>
   </div>):<span className="gp-pos-pet-empty">Choose a customer to see their pets.</span>}
  </div></div>
  <div className="gp-pos-pet-instructions" aria-label="Selected pet grooming instructions">
   {pet?<><button type="button" className="gp-btn" onClick={onNotes} title="View grooming instructions in Notes">{pet.name}</button><span>{summaries[pet.id]||'No grooming instructions yet'}</span><PetCare pet={pet}/>{warnVet&&!pet.veterinarian&&<span role="status">Veterinarian information missing</span>}{pet.vipEligible&&<span>VIP eligible</span>}</>:<span>Select a pet to view grooming instructions.</span>}
  </div>
 </section>;
}
