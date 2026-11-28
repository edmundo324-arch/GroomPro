"use client";
import {useEffect,useRef,useState} from 'react';
import {FloatingEditorWindow} from './floating-editor-window';
import {promotingServices,promotingServiceItem,offerTodayLabel,offerTodayLine} from '../lib/service-promotion';
export function PromotingServices({services,pets,petId,onPetChange,onToggle,lines,disabled,pending,blank=false}:{services:any[];pets:any[];petId:string;onPetChange:(id:string)=>void;onToggle:(item:any)=>void;lines:any[];disabled:boolean;pending:string[];blank?:boolean}){
 const [open,setOpen]=useState(false),[showAll,setShowAll]=useState(false),[query,setQuery]=useState('');
 const search=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(open){const frame=requestAnimationFrame(()=>{search.current?.focus();search.current?.select()});return()=>cancelAnimationFrame(frame)}},[open]);
 const choices=promotingServices(services).filter(s=>(s.name+' '+offerTodayLabel(s)+' '+(s.description||'')).toLowerCase().includes(query.toLowerCase()));
 const available=pets.filter(p=>showAll||p.active!==false&&lines.some(l=>(l.petId||l.pet?.id)===p.id&&l.lineType!=='PRODUCT'));
 const selected=available.some(p=>p.id===petId)?petId:available[0]?.id||'';
 return <section className="gp-pos-promotions" aria-label="Offer Today"><button type="button" className="gp-btn" disabled={blank} onClick={()=>setOpen(true)}>Offer Today</button>
 {open&&<FloatingEditorWindow windowKey="offer-today" title="Offer Today" initialSize={{width:520,height:470}} onClose={()=>setOpen(false)} style={{zIndex:2000,fontSize:16,lineHeight:1.4}}>
 <div style={{display:'flex',gap:12,alignItems:'center',padding:12}}><label>Dog <select aria-label="Dog for added item" value={selected} onChange={e=>onPetChange(e.target.value)} disabled={disabled||!available.length}><option value="">Choose Dog</option>{available.map(p=><option key={p.id} value={p.id} disabled={p.active===false}>{p.name}{p.active===false?' (Inactive)':''}</option>)}</select></label><label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show All</label></div>
 {!available.length&&<p>Select Show All to choose another dog owned by this customer.</p>}
 <input ref={search} aria-label="Search Offer Today" placeholder="Search Name or Description" value={query} onChange={e=>setQuery(e.target.value)} style={{width:'100%'}}/>
 <div role="group" aria-label="Offer Today quick choices">{choices.map((item,i)=><button type="button" className="gp-btn" key={item.id} aria-pressed={!!offerTodayLine(lines,item.id,selected)} disabled={disabled||!selected||pets.find(p=>p.id===selected)?.active===false||pending.includes(`offer:${item.id}:${selected}`)} onClick={()=>onToggle(promotingServiceItem(item,selected))} style={{display:'block',width:'100%',textAlign:'left',whiteSpace:'normal',padding:14,borderBottom:'1px solid #bdcedc',background:i%2?'#eff7fa':'#fff8e9'}}><strong>{offerTodayLine(lines,item.id,selected)?'✓ ':''}{offerTodayLabel(item)}</strong><span style={{float:'right'}}>${(item.priceCents/100).toFixed(2)}</span>{item.description&&<small style={{display:'block',whiteSpace:'normal'}}>{item.description}</small>}</button>)}</div>
 {!choices.length&&<p>No Matching Offers. Mark services as Offer Today in the service editor.</p>}
 </FloatingEditorWindow>}</section>;
}
