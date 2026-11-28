"use client";
import {helpfulError} from '../lib/human-communication';
import {useEffect,useRef,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {HelpPopup} from './help-popup';
export function TicketConfirmationRequest({timezone,ticketId,visitStatus,scheduledStart,onEditCustomer}:{timezone:string;ticketId:string;visitStatus:string;scheduledStart:string|null;onEditCustomer:(customerId:string)=>void}){
 const [notice,setNotice]=useState<any>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const operation=useRef(crypto.randomUUID()),currentTicket=useRef(ticketId);currentTicket.current=ticketId;
 const [retry,setRetry]=useState(0),[readError,setReadError]=useState('');
 useEffect(()=>{
  let active=true,latest=0;
  setNotice(null);setMessage('');setReadError('');setBusy(false);operation.current=crypto.randomUUID();
  const refresh=async()=>{
   if(!ticketId)return;
   const sequence=++latest;
   try{
    const r=await employeeFetch('/api/tickets/confirmation-request?ticketId='+encodeURIComponent(ticketId),{cache:'no-store'});
    const data=await r.json();
    if(!r.ok||typeof data.canRequest!=='boolean')throw Error(data.error||'Reconnect to check whether this appointment can receive a confirmation request.');
    if(active&&sequence===latest){setNotice(data);setReadError('');}
   }catch(error){if(active&&sequence===latest){setNotice(null);setReadError(helpfulError((error as Error).message));}}
  };
  void refresh();
  const changed=(e:Event)=>{const url=String((e as CustomEvent).detail?.url||'');if(url.startsWith('/api/customers/')||url.startsWith('/api/tickets/'))void refresh()};
  const visibleRefresh=()=>{if(document.visibilityState==='visible')void refresh()};
  const timer=window.setInterval(visibleRefresh,60000);
  window.addEventListener('focus',visibleRefresh);window.addEventListener('online',refresh);window.addEventListener('groompro:data-changed',changed);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',visibleRefresh);window.removeEventListener('online',refresh);window.removeEventListener('groompro:data-changed',changed)};
 },[ticketId,visitStatus,scheduledStart,retry]);
 async function send(){if(busy)return;if(!notice){setRetry(v=>v+1);return;}if(!notice.canRequest){setMessage(notice.reason);return;}setBusy(true);try{const r=await employeeFetch('/api/tickets/confirmation-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,scheduledStart:notice.scheduledStart,operationId:operation.current})}),data=await r.json();if(!r.ok)throw Error(data.error);if(currentTicket.current===ticketId){operation.current=crypto.randomUUID();setMessage(data.message);}}catch(e){if(currentTicket.current===ticketId)setMessage((e as Error).message)}finally{if(currentTicket.current===ticketId)setBusy(false)}}
 const history:{id:string;channel:string;sentAt:string;source?:string}[]=notice?.sentHistory||[];
 const stamp=(entry:typeof history[number])=>(entry.channel==='SMS'?'Text':'Email')+' sent '+(entry.source==='Manual'?'by staff ':entry.source==='Automatic'?'automatically ':'')+new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(entry.sentAt));
 return <div className="gp-ticket-confirmation-request" style={{padding:'4px 10px'}}>
  {notice?.bouncedEmail&&<div role="alert">An email to <strong>{notice.bouncedEmail}</strong> bounced. Please check and correct this customer’s email at your earliest convenience. <button type="button" className="gp-btn" onClick={()=>onEditCustomer(notice.customerId)}>Fix email</button></div>}
  <button type="button" className="gp-btn" disabled={!ticketId||busy} onClick={send}>Send confirmation request</button>{history.length>0&&<small aria-label="Appointment messages sent" style={{display:'inline-grid',gap:2,marginInline:8,fontSize:'0.78em',verticalAlign:'middle',maxHeight:'5em',overflowY:'auto'}}>{history.map(entry=><time key={entry.id} dateTime={entry.sentAt}>{stamp(entry)}</time>)}</small>}<HelpPopup label="Send confirmation request">Ask the customer to confirm this appointment now, outside the normal schedule. The saved schedule and their reminder choices stay unchanged. If the customer is late and their dogs have not checked in, send an “Are you on your way?” message.</HelpPopup>
  <span role="status">{message?helpfulError(message):readError||notice?.reason||(!ticketId?'Save this appointment first.':!notice?'Checking appointment…':'')}</span>{readError&&<button type="button" className="gp-btn" onClick={()=>setRetry(v=>v+1)}>Try Again</button>}
 </div>;
}
