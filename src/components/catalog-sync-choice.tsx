"use client";
import {useId} from 'react';
import {openPosTicket} from '../lib/workspace-navigation';

export type CatalogSyncScope='NONE'|'ALL'|'FUTURE';
export type CatalogSyncResult={updated:number;unchanged:number;review:{ticketId:string;orderNumber:number;reason:string}[];ticketIds:string[];vipBenefitsUpdated?:number;vipPricesUpdated?:number;vipScheduledChargesUpdated?:number;vipChargesForReview?:number};

const choices:{value:CatalogSyncScope;label:string;description:string}[]=[
 {value:'ALL',label:'Today and Future Appointments',description:'Update matching saved, unpaid appointments for today and later, plus open tickets without an appointment date. Leave earlier dated tickets unchanged.'},
 {value:'FUTURE',label:'Future Appointments Only — Exclude Today',description:'Update matching saved, unpaid appointments after today, using each shop’s local date. Leave today’s tickets and tickets without an appointment date unchanged.'},
 {value:'NONE',label:'New Bookings Only',description:'Leave saved appointments unchanged. Use the new details when adding this service or package to a booking.'},
];

export function CatalogSyncChoice({value,onChange}:{value:CatalogSyncScope;onChange:(value:CatalogSyncScope)=>void}){
 const name=useId();
 return <fieldset className="gp-settings-card" style={{marginTop:16}}>
  <legend>Where Should These Changes Apply?</legend>
  <div style={{display:'grid',gap:10}}>{choices.map(choice=><label key={choice.value} style={{display:'flex',alignItems:'flex-start',gap:8}}>
   <input type="radio" name={name} value={choice.value} checked={value===choice.value} onChange={()=>onChange(choice.value)}/>
   <span><strong>{choice.label}</strong><small style={{display:'block',marginTop:3}}>{choice.description}</small></span>
  </label>)}</div>
  <p className="gp-subtitle">Closed and paid tickets stay unchanged. Staff adjustments are kept; appointments that need a decision are listed for review.</p>
 </fieldset>;
}

export function VipCatalogSyncChoice({benefits,price,onBenefitsChange,onPriceChange}:{benefits:boolean;price:boolean;onBenefitsChange:(value:boolean)=>void;onPriceChange:(value:boolean)=>void}){
 return <fieldset className="gp-settings-card" style={{marginTop:16}}>
  <legend>Apply Changes to Current VIP Members</legend>
  <div style={{display:'grid',gap:10}}>
   <label style={{display:'flex',alignItems:'flex-start',gap:8}}>
    <input type="checkbox" checked={benefits} onChange={event=>onBenefitsChange(event.target.checked)}/>
    <span><strong>Update Included Services for Current Members</strong><small style={{display:'block',marginTop:3}}>Give current members the revised included services without changing their price.</small></span>
   </label>
   <label style={{display:'flex',alignItems:'flex-start',gap:8}}>
    <input type="checkbox" checked={price} onChange={event=>onPriceChange(event.target.checked)}/>
    <span><strong>Update Future Membership Charges for Current Members</strong><small style={{display:'block',marginTop:3}}>Use the revised price for upcoming membership charges. Previously paid charges stay unchanged.</small></span>
   </label>
  </div>
  <p className="gp-subtitle">Choose either update, both, or neither. Billing dates, the $1 activation fee, and previously signed agreements stay unchanged.</p>
 </fieldset>;
}

export function CatalogSyncSummary({result}:{result:CatalogSyncResult}){
 const vip=result.vipBenefitsUpdated!==undefined||result.vipPricesUpdated!==undefined||result.vipScheduledChargesUpdated!==undefined;
 const review=result.review||[];
 return <div className="gp-settings-card" style={{marginBottom:16}} aria-label="Catalog Update Results">
  {(!vip||result.updated>0||result.unchanged>0)&&<p role="status">{result.updated===1?'1 appointment updated.':`${result.updated} appointments updated.`} {result.unchanged>0&&`${result.unchanged} left unchanged.`}</p>}
  {vip&&<div role="status">
   {result.vipBenefitsUpdated!==undefined&&<p>Included services updated for {result.vipBenefitsUpdated} {result.vipBenefitsUpdated===1?'membership':'memberships'}.</p>}
   {result.vipPricesUpdated!==undefined&&<p>Future price updated for {result.vipPricesUpdated} {result.vipPricesUpdated===1?'membership':'memberships'}.</p>}
   {result.vipScheduledChargesUpdated!==undefined&&<p>{result.vipScheduledChargesUpdated} upcoming {result.vipScheduledChargesUpdated===1?'charge':'charges'} updated.</p>}
   {(result.vipChargesForReview||0)>0&&<p>{result.vipChargesForReview} scheduled {result.vipChargesForReview===1?'charge kept':'charges kept'} for individual review.</p>}
  </div>}
  {review.length>0&&<details>
   <summary>Review {review.length} {review.length===1?'Appointment':'Appointments'}</summary>
   <p>Review the saved choices below. Some details were kept to preserve staff adjustments or scheduling decisions.</p>
   <ul style={{paddingLeft:20}}>{review.map((entry,index)=><li key={entry.ticketId+':'+index} style={{marginBottom:10}}>
    <strong>Ticket #{entry.orderNumber}</strong> — {entry.reason}{' '}
    <button type="button" className="gp-btn" onClick={()=>openPosTicket(entry.ticketId)}>Open Ticket #{entry.orderNumber}</button>
   </li>)}</ul>
  </details>}
 </div>;
}
