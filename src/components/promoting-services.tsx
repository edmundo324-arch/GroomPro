"use client";
import {promotingServices,promotingServiceItem} from '../lib/service-promotion';
export function PromotingServices({services,pets,petId,onPetChange,onAdd,disabled,pending}:{services:any[];pets:any[];petId:string;onPetChange:(id:string)=>void;onAdd:(item:any)=>void;disabled:boolean;pending:string[]}){
 const choices=promotingServices(services);
 return <section className="gp-pos-promotions" aria-label="Promoting Services">
 <span className="gp-pos-promotions-label">Promoting Services</span>
 <select aria-label="Dog for added item" value={petId} onChange={e=>onPetChange(e.target.value)} disabled={disabled||!pets.length}><option value="">Choose dog</option>{pets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <div className="gp-pos-promotions-choices" role="group" aria-label="Promoting service quick choices" tabIndex={0}>
 {choices.map(item=><button type="button" className="gp-btn" key={item.id} title={item.name} disabled={disabled||!petId||pending.includes(`line:add:${item.id}:${petId}`)} onClick={()=>onAdd(promotingServiceItem(item,petId))}>{item.name} · ${(item.priceCents/100).toFixed(2)}</button>)}
 {!choices.length&&<span className="gp-pos-promotions-empty">Select Promoting Services in the service editor.</span>}
 </div></section>
}
