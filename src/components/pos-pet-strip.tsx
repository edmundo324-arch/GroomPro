"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {petVipStatus} from '../lib/pet-vip-status';
import {petIndicatorSettings} from '../lib/pet-indicators';
import {PetCare} from './pet-care';
type Props={desktopNotesPopup?:boolean;indicators?:ReturnType<typeof petIndicatorSettings>;pets:any[];includedIds:string[];packageIds:string[];disabled:boolean;warnVet:boolean;summaries:Record<string,string>;onInclude:(pet:any,included:boolean)=>void;onPackage:(id:string)=>void;onNotes:()=>void};
export function PosPetStrip({pets,desktopNotesPopup=false,indicators,includedIds,packageIds,disabled,warnVet,summaries,onInclude,onPackage,onNotes}:Props){
 const [indicatorLabel,setIndicatorLabel]=useState('');
 const [notePopup,setNotePopup]=useState<{id:string;left:number;top:number;above:boolean}|null>(null);
 const tooltipId=useId();
 function showNote(id:string,anchor:HTMLElement){
  if(!desktopNotesPopup)return;
  const box=anchor.getBoundingClientRect(),above=box.bottom>window.innerHeight-160;
  setNotePopup({id,left:Math.max(8,Math.min(box.left,window.innerWidth-336)),top:above?box.top-6:box.bottom+6,above});
 }
 useEffect(()=>{
  if(!notePopup)return;
  const close=()=>setNotePopup(null);
  window.addEventListener('scroll',close,true);
  window.addEventListener('resize',close);
  return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};
 },[notePopup]);
 const [selected,setSelected]=useState(''),scroll=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({left:false,right:false});
 const measure=()=>{const el=scroll.current;if(el)setEdges({left:el.scrollLeft>1,right:el.scrollLeft+el.clientWidth<el.scrollWidth-1})};
 useEffect(()=>{const el=scroll.current;if(!el)return;measure();const observer=new ResizeObserver(measure);observer.observe(el);el.addEventListener('scroll',measure,{passive:true});return()=>{observer.disconnect();el.removeEventListener('scroll',measure)}},[pets]);

 const pet=pets.find(p=>p.id===selected)||pets[0];
 const popupPet=desktopNotesPopup&&notePopup?pets.find(p=>p.id===notePopup.id):null;
 return <section className="gp-pos-pet-strip" aria-label="Customer pets">
  <div className="gp-pos-pet-row">{(edges.left||edges.right)&&<button type="button" className="gp-btn gp-pet-strip-nav" aria-label="Previous pets" disabled={!edges.left} onClick={()=>scroll.current?.scrollBy({left:-(scroll.current.clientWidth*.75),behavior:'smooth'})}>‹</button>}<div ref={scroll} className="gp-pos-pet-scroll" aria-label="Pet choices" tabIndex={0}>
   {pets.length?pets.map(p=><div className="gp-pos-pet-chip" key={p.id} data-selected={pet?.id===p.id} tabIndex={0} onPointerDown={()=>{setSelected(p.id);setIndicatorLabel('')}} onFocus={()=>{if(pet?.id!==p.id)setIndicatorLabel('');setSelected(p.id)}}>
    <button type="button" className="gp-btn" disabled={disabled||p.active===false} aria-pressed={packageIds.includes(p.id)} title={popupPet?.id===p.id?undefined:p.active===false?'Inactive pet':'Add or remove this dog’s assigned grooming package'} onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))showNote(p.id,event.currentTarget)}} onBlur={()=>setNotePopup(null)} onKeyDown={event=>{if(event.key==='Escape'&&notePopup){event.stopPropagation();setNotePopup(null);}}} aria-describedby={popupPet?.id===p.id?tooltipId:undefined} onClick={()=>{setSelected(p.id);onPackage(p.id)}}><span onPointerEnter={event=>{if(event.pointerType==='mouse')showNote(p.id,event.currentTarget)}} onPointerLeave={()=>setNotePopup(null)}>{p.name}</span><small>{[p.weightLbs!=null?`${Number(p.weightLbs)} lb`:'',p.breed].filter(Boolean).join(' · ')}</small></button>
    <span className="gp-pet-strip-indicators">{[petVipStatus(p).code,
     ...(p.careFlags?.vipConversationAt?['CONVERSATION']:[]),...(!p.veterinarian?['VET']:[]),
     ...(summaries[p.id]?['GROOMING']:[]),...(p.careFlags&&Object.entries(p.careFlags).some(([key,value])=>!key.startsWith('vip')&&value===true)?['HANDLING']:[])
    ].map(key=>{const icon=indicators?.[key];return icon?.enabled?<button key={key} type="button" className="gp-pet-indicator" aria-label={p.name+': '+icon.label} title={icon.label} style={{color:icon.color}} onClick={()=>{setSelected(p.id);setIndicatorLabel(icon.label)}}>{icon.symbol==='★'?<svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m10 2.5 2.3 4.7 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"/></svg>:icon.symbol==='💬'?<svg aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17.5 9c0 3.3-3.2 5.8-7.5 5.8H8l-4 2.5v-3.8C2.9 12.4 2.5 11 2.5 9c0-3.3 3.2-5.8 7.5-5.8s7.5 2.5 7.5 5.8Z"/><path d="m7.3 9.2 1.8 1.7 3.5-3.4"/></svg>:<span className={['?','✓','✕'].includes(icon.symbol)?'gp-pet-indicator-circle':undefined}>{icon.symbol}</span>}</button>:null})}</span>
   </div>):<div className="gp-pos-pet-chip gp-pos-empty-pet"><button type="button" className="gp-btn" disabled><span>Pet name</span><small>Weight · Breed</small></button></div>}
  </div>{(edges.left||edges.right)&&<button type="button" className="gp-btn gp-pet-strip-nav" aria-label="More pets" disabled={!edges.right} onClick={()=>scroll.current?.scrollBy({left:scroll.current.clientWidth*.75,behavior:'smooth'})}>›</button>}</div>
  <div className="gp-pos-pet-instructions" aria-label="Selected pet grooming instructions">
   {pet?<><button type="button" className="gp-btn" onClick={onNotes} title="View grooming instructions in Notes">{desktopNotesPopup?'Grooming notes':pet.name}</button>{!desktopNotesPopup&&<span>{summaries[pet.id]||'No grooming instructions yet'}</span>}<PetCare pet={pet}/>{warnVet&&!pet.veterinarian&&<span role="status">Veterinarian information missing</span>}{indicatorLabel&&<span role="status">{indicatorLabel}</span>}</>:<span>Grooming instructions</span>}
  </div>
  {popupPet&&notePopup&&createPortal(<div id={tooltipId} className="gp-pos-grooming-popup" role="tooltip"
   style={{left:notePopup.left,top:notePopup.top,transform:notePopup.above?'translateY(-100%)':undefined}}>
   <strong>{popupPet.name} · Grooming notes</strong><div>{summaries[popupPet.id]||'No grooming instructions yet'}</div>
  </div>,document.body)}
 </section>;
}
