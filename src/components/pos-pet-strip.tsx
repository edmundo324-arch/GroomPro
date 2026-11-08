"use client";
import {useEffect,useRef,useState} from 'react';
import {petVipStatus} from '../lib/pet-vip-status';
import {petIndicatorSettings} from '../lib/pet-indicators';
import {PetCare} from './pet-care';
type Props={indicators?:ReturnType<typeof petIndicatorSettings>;pets:any[];includedIds:string[];packageIds:string[];disabled:boolean;warnVet:boolean;summaries:Record<string,string>;onInclude:(pet:any,included:boolean)=>void;onPackage:(id:string)=>void;onNotes:()=>void};
export function PosPetStrip({pets,indicators,includedIds,packageIds,disabled,warnVet,summaries,onInclude,onPackage,onNotes}:Props){
 const [indicatorLabel,setIndicatorLabel]=useState('');
 const [selected,setSelected]=useState(''),scroll=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({left:false,right:false});
 const measure=()=>{const el=scroll.current;if(el)setEdges({left:el.scrollLeft>1,right:el.scrollLeft+el.clientWidth<el.scrollWidth-1})};
 useEffect(()=>{const el=scroll.current;if(!el)return;measure();const observer=new ResizeObserver(measure);observer.observe(el);el.addEventListener('scroll',measure,{passive:true});return()=>{observer.disconnect();el.removeEventListener('scroll',measure)}},[pets]);

 const pet=pets.find(p=>p.id===selected)||pets[0];
 return <section className="gp-pos-pet-strip" aria-label="Customer pets">
  <div className="gp-pos-pet-row"><span>Pets ({pets.length}):</span>{(edges.left||edges.right)&&<button type="button" className="gp-btn gp-pet-strip-nav" aria-label="Previous pets" disabled={!edges.left} onClick={()=>scroll.current?.scrollBy({left:-(scroll.current.clientWidth*.75),behavior:'smooth'})}>‹</button>}<div ref={scroll} className="gp-pos-pet-scroll" aria-label="Pet choices" tabIndex={0}>
   {pets.length?pets.map(p=><div className="gp-pos-pet-chip" key={p.id} data-selected={pet?.id===p.id} tabIndex={0} onPointerDown={()=>{setSelected(p.id);setIndicatorLabel('')}} onFocus={()=>{if(pet?.id!==p.id)setIndicatorLabel('');setSelected(p.id)}}>
    <button type="button" className="gp-btn" disabled={disabled||p.active===false} aria-pressed={packageIds.includes(p.id)} title={p.active===false?'Inactive pet':'Add or remove this dog’s assigned grooming package'} onClick={()=>{setSelected(p.id);onPackage(p.id)}}><span>{p.name}</span><small>{p.weightLbs!=null?`${Number(p.weightLbs)}lb `:''}{p.breed||''}</small></button>
    <span className="gp-pet-strip-indicators">{[petVipStatus(p).code,
     ...(p.careFlags?.vipConversationAt?['CONVERSATION']:[]),...(!p.veterinarian?['VET']:[]),
     ...(summaries[p.id]?['GROOMING']:[]),...(p.careFlags&&Object.entries(p.careFlags).some(([key,value])=>!key.startsWith('vip')&&value===true)?['HANDLING']:[])
    ].map(key=>{const icon=indicators?.[key];return icon?.enabled?<button key={key} type="button" className="gp-pet-indicator" aria-label={p.name+': '+icon.label} title={icon.label} style={{color:icon.color}} onClick={()=>{setSelected(p.id);setIndicatorLabel(icon.label)}}>{icon.symbol==='💬'?<svg aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17.5 9c0 3.3-3.2 5.8-7.5 5.8H8l-4 2.5v-3.8C2.9 12.4 2.5 11 2.5 9c0-3.3 3.2-5.8 7.5-5.8s7.5 2.5 7.5 5.8Z"/><path d="m7.3 9.2 1.8 1.7 3.5-3.4"/></svg>:icon.symbol}</button>:null})}</span>
   </div>):<span className="gp-pos-pet-empty">Choose a customer to see their pets.</span>}
  </div>{(edges.left||edges.right)&&<button type="button" className="gp-btn gp-pet-strip-nav" aria-label="More pets" disabled={!edges.right} onClick={()=>scroll.current?.scrollBy({left:scroll.current.clientWidth*.75,behavior:'smooth'})}>›</button>}</div>
  <div className="gp-pos-pet-instructions" aria-label="Selected pet grooming instructions">
   {pet?<><button type="button" className="gp-btn" onClick={onNotes} title="View grooming instructions in Notes">{pet.name}</button><span>{summaries[pet.id]||'No grooming instructions yet'}</span><PetCare pet={pet}/>{warnVet&&!pet.veterinarian&&<span role="status">Veterinarian information missing</span>}{indicatorLabel&&<span role="status">{indicatorLabel}</span>}</>:<span>Select a pet to view grooming instructions.</span>}
  </div>
 </section>;
}
