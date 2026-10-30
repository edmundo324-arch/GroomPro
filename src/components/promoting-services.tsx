"use client";
import {promotingServices,promotingServiceItem,offerTodayLabel,offerTodayLine} from '../lib/service-promotion';
export function PromotingServices({services,pets,petId,onPetChange,onToggle,lines,disabled,pending}:{services:any[];pets:any[];petId:string;onPetChange:(id:string)=>void;onToggle:(item:any)=>void;lines:any[];disabled:boolean;pending:string[]}){
 const choices=promotingServices(services);
 return <section className="gp-pos-promotions" aria-label="Offer Today">
 <span className="gp-pos-promotions-label">Offer Today</span>
 <select aria-label="Dog for added item" value={petId} onChange={e=>onPetChange(e.target.value)} disabled={disabled||!pets.length}><option value="">Choose dog</option>{pets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <div className="gp-pos-promotions-choices" role="group" aria-label="Offer Today quick choices" tabIndex={0}>
 {choices.map(item=><button type="button" className="gp-btn" key={item.id} title={item.name} aria-pressed={!!offerTodayLine(lines,item.id,petId)} disabled={disabled||!petId||pending.includes(`offer:${item.id}:${petId}`)} onClick={()=>onToggle(promotingServiceItem(item,petId))}><span>{offerTodayLabel(item)}</span><span className="gp-pos-offer-price">${(item.priceCents/100).toFixed(2)}</span></button>)}
 {!choices.length&&<span className="gp-pos-promotions-empty">Select Offer Today in the service editor.</span>}
 </div></section>
}
