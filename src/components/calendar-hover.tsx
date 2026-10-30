"use client";
import {useLayoutEffect,useRef,useState} from 'react';
import {packageSummaries,serviceLabel} from '../lib/package-display';
import {HoverDetail,hoverValue} from '../lib/calendar-hover-details';
import {popupFields} from '../lib/calendar-popup-layout';
import {petVipStatus} from '../lib/pet-vip-status';
import {PetVipBadge} from './pet-vip-badge';
export function CalendarHover({hover,fields,labels,details}:{hover:any;fields:string[];labels?:boolean;details:HoverDetail[]}){
 const ref=useRef<HTMLElement>(null),[top,setTop]=useState(hover.y);
 useLayoutEffect(()=>{if(ref.current)setTop(Math.max(8,Math.min(hover.y,window.innerHeight-ref.current.getBoundingClientRect().height-8)))},[hover.y,details,fields]);
 const chosen=popupFields(fields),selected=new Set(chosen),rank=new Map(chosen.map((key,index)=>[key,index]));
 const ordered=(items:HoverDetail[])=>items.slice().sort((a,b)=>(rank.get(a.key)??chosen.length)-(rank.get(b.key)??chosen.length));
 const show=(items:HoverDetail[],omit:string[]=[])=>{const seen=new Set<string>();return ordered(items).filter(d=>!omit.includes(d.key)&&!seen.has(d.key+':'+d.value)&&!!seen.add(d.key+':'+d.value)).map((d,i)=><span key={d.key+':'+i}>{labels?<><b>{d.label}:</b> </>:null}{d.value}</span>)};
 const t=hover.ticket;
 const primary=new Set(['pet.name','pet.weightLbs','pet.breed','pet.vipEligible','pet.notes','pet.groomingNotes']);
 return <aside ref={ref} role="tooltip" className="gp-appointment-hover gp-human-hover" style={{left:hover.x,top,width:hover.width,maxWidth:hover.width}}>
 <header>{selected.has('time')&&<strong className="gp-hover-time">{t.scheduledStart?new Date(t.scheduledStart).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Unscheduled'}</strong>}{selected.has('customer')&&<strong>{t.customer.firstName} {t.customer.lastName}</strong>}<div className="gp-hover-facts">{show(details.filter(d=>d.key.startsWith('customer.')&&d.key!=='customer.vipStatus'),selected.has('customer')?['customer.firstName','customer.lastName']:[])}</div><div className="gp-hover-facts">{show(details.filter(d=>!d.petId&&!d.lineId&&!d.key.startsWith('customer.')))}</div></header>
 {t.pets.map(({pet}:any,i:number)=>{
  const petDetails=details.filter(d=>d.petId===pet.id&&!d.lineId);
  const value=(key:string,fallback:any)=>petDetails.find(d=>d.key===key)?.value||hoverValue(key,fallback);
  const lines=t.lines.filter((line:any)=>line.petId===pet.id);
  const services=packageSummaries(lines).map(service=>service.name+' $'+(service.totalCents/100).toFixed(2));
  const lineDetails=details.filter(d=>d.petId===pet.id&&d.lineId&&!(selected.has('package')&&['line.packageName','line.description','line.unitPriceCents','line.totalCents'].includes(d.key)));
  const vip=value('pet.vipEligible',null)||petVipStatus(pet).label;
  const permanent=value('pet.notes',pet.notes);
  const usual=pet.groomingNotes||petDetails.find(d=>d.key==='pet.groomingNotes')?.value;
  return <section key={pet.id||i}>
   <div className="gp-hover-facts gp-hover-pet-identity">
    {selected.has('pet.name')&&<strong>{labels?'Name: ':''}{value('pet.name',pet.name)}</strong>}
    {selected.has('pet.weightLbs')&&value('pet.weightLbs',pet.weightLbs)&&<span>{labels?'Weight: ':''}{value('pet.weightLbs',pet.weightLbs)}</span>}
    {selected.has('pet.breed')&&value('pet.breed',pet.breed)&&<span>{labels?'Breed: ':''}{value('pet.breed',pet.breed)}</span>}
    {selected.has('pet.vipEligible')&&<PetVipBadge label={vip}/>}
   </div>
   {selected.has('package')&&<div className="gp-hover-services">{labels&&services.length?'Services: ':''}{services.join(' · ')}</div>}
   {selected.has('todayNotes')&&pet.todaysGroomingNotes&&<p>{labels?"Today: ":''}{pet.todaysGroomingNotes}</p>}
   {selected.has('pet.notes')&&permanent&&<p>{labels?'Permanent notes: ':''}{permanent}</p>}
   <div className="gp-hover-facts">{show([...petDetails.filter(d=>!primary.has(d.key)),...(selected.has('notes')&&usual?[{key:'notes',label:'Grooming notes',value:usual,petId:pet.id}]:[])])}</div>
   {Object.entries(ordered(lineDetails).reduce((groups:Record<string,HoverDetail[]>,d)=>{(groups[d.lineId!]??=[]).push(d);return groups},{})).map(([id,items])=><div className="gp-hover-facts" key={id}>{new Set(lineDetails.map(d=>d.lineId)).size>1&&<strong>{serviceLabel(lines.find((line:any)=>line.id===id)||{})} </strong>}{show(items,selected.has('package')?['line.packageName']:[])}</div>)}
  </section>;
 })}
 {details.some(d=>d.lineId&&!d.petId)&&<section><div className="gp-hover-facts">{show(details.filter(d=>d.lineId&&!d.petId))}</div></section>}
 </aside>;
}
