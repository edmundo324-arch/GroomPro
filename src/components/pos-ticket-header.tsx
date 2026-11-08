"use client";

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

export function PosVisitStamps({checkedIn,completed,timezone,contactNeeded=false}:{
 checkedIn?:string|null;completed?:string|null;timezone:string;contactNeeded?:boolean
}){
 const format=(value:string)=>new Date(value).toLocaleTimeString(undefined,{timeZone:timezone,hour:'numeric',minute:'2-digit'});
 return <div className="gp-pos-visit-stamps" aria-label="Visit times">
  <span>Checked in {checkedIn?<time dateTime={checkedIn}>{format(checkedIn)}</time>:'—'}</span>
  <span>Completed {completed?<time dateTime={completed}>{format(completed)}</time>:'—'}</span>
  {contactNeeded&&<strong className="gp-pos-contact-needed" role="status"><span aria-hidden="true">!</span> Call and text</strong>}
 </div>;
}

export function PosTicketLabel({number,compact=false}:{number?:number;compact?:boolean}){
 return <span className="gp-pos-ticket-label">{compact?
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="POS Ticket"><title>POS Ticket</title><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3"/></svg>:'POS Ticket'}
  {number?' #'+number:''}
 </span>;
}

export function PosDetailsButton({expanded,onClick}:{expanded:boolean;onClick:()=>void}){
 return <button type="button" className="gp-btn gp-phone-only gp-pos-details-toggle" aria-expanded={expanded} aria-label="Ticket details" title="Ticket details" onClick={onClick}>
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
 </button>;
}
