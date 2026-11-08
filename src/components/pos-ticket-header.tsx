"use client";
import {useEffect,useRef,useState} from 'react';

export function PosCustomerTitle({name,onEdit,onReplace,disabled=false}:{
 name:string;onEdit:()=>void;onReplace:()=>void;disabled?:boolean
}){
 return <div className="gp-pos-customer-title">
  {name&&<button type="button" className="gp-btn gp-pos-edit-customer" aria-label={'Edit customer '+name} title="Edit customer" onClick={onEdit}>
   <span>{name}</span>
   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm11-11 4 4M4 16l4 4"/></svg>
  </button>}
  <button type="button" className="gp-btn" disabled={disabled} aria-label={name?'Replace customer':'Choose customer'} title={name?'Replace customer':'Choose customer'} onClick={onReplace}>
   {name?<svg width="26" height="16" viewBox="0 0 36 22" fill="currentColor" aria-hidden="true">
    <circle cx="7" cy="6" r="3.5"/><circle cx="29" cy="6" r="3.5"/>
    <path d="M1 20v-3a6 6 0 0 1 12 0v3zM23 20v-3a6 6 0 0 1 12 0v3z"/>
    <path d="M14 8h7m-3-3 3 3-3 3m4 4h-7m3-3-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
   </svg>:'Choose customer'}
  </button>
 </div>;
}

export function PosVisitStamps({checkedIn,completed,called,texted,timezone,contactNeeded=false}:{
 checkedIn?:string|null;completed?:string|null;called?:string|null;texted?:string|null;timezone:string;contactNeeded?:boolean
}){
 const format=(value:string)=>new Date(value).toLocaleTimeString(undefined,{timeZone:timezone,hour:'numeric',minute:'2-digit'});
 const stamps=[
  ['Checked in',checkedIn,'M3 12h11m-4-4 4 4-4 4M16 4h5v16h-5'],
  ['Completed',completed,'M5 12l4 4L19 6M5 5h8m6 7v7H5v-3'],
  ['Called',called,'M6 3h3l2 5-2 2a13 13 0 0 0 5 5l2-2 5 2v3c0 2-2 3-4 3A17 17 0 0 1 3 7c0-2 1-4 3-4Z'],
  ['Texted',texted,'M3 5h18v12H9l-6 4V5Zm4 5h10m-10 3h6'],
 ] as const;
 return <div className="gp-pos-visit-stamps" aria-label="Visit times">
  {stamps.map(([label,at,path])=><span key={label} title={at?label+' '+format(at):label} aria-label={label}>
   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path||''}/></svg>
   {at&&<time dateTime={at}>{format(at)}</time>}
  </span>)}
  {contactNeeded&&<strong className="gp-pos-contact-needed" role="status"><span aria-hidden="true">!</span> Call and text</strong>}
 </div>;
}

export function PosTicketLabel({number,compact=false}:{number?:number;compact?:boolean}){
 return <span className="gp-pos-ticket-label">{compact?
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="POS Ticket"><title>POS Ticket</title><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3"/></svg>:'POS Ticket'}
  {number?' #'+number:''}
 </span>;
}

export function PosHeaderMenu({details,onDetails,onCall,callPending=false}:{
 details?:boolean;onDetails?:()=>void;onCall?:()=>void;callPending?:boolean
}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 return <div ref={root} className="gp-pos-header-menu" onKeyDown={e=>{if(open&&e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus()}}}>
  <button ref={button} type="button" className="gp-btn" aria-label="Ticket actions" title="Ticket actions" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>⋯</button>
  {open&&<div className="gp-ticket-tab-menu">
   {onDetails&&<button type="button" className="gp-btn" onClick={()=>{setOpen(false);onDetails()}}>{details?'Back to ticket':'Details'}</button>}
   <button type="button" className="gp-btn" disabled={!onCall||callPending} onClick={()=>{setOpen(false);onCall?.()}}>Record pickup call</button>
  </div>}
 </div>;
}
