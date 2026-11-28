"use client";
import {helpfulError} from '../lib/human-communication';
import {useEffect,useRef,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {HelpPopup} from './help-popup';
export function TicketConfirmationRequest({ticketId,visitStatus,scheduledStart,onEditCustomer}:{ticketId:string;visitStatus:string;scheduledStart:string|null;onEditCustomer:(customerId:string)=>void}){
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
  window.addEventListener('online',refresh);window.addEventListener('groompro:data-changed',changed);
  return()=>{active=false;window.removeEventListener('online',refresh);window.removeEventListener('groompro:data-changed',changed)};
 },[ticketId,visitStatus,scheduledStart,retry]);
 async function send(){if(!notice||busy)return;setBusy(true);try{const r=await employeeFetch('/api/tickets/confirmation-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,scheduledStart:notice.scheduledStart,operationId:operation.current})}),data=await r.json();if(!r.ok)throw Error(data.error);if(currentTicket.current===ticketId){operation.current=crypto.randomUUID();setMessage(data.message);}}catch(e){if(currentTicket.current===ticketId)setMessage((e as Error).message)}finally{if(currentTicket.current===ticketId)setBusy(false)}}
 return <div className="gp-ticket-confirmation-request" style={{padding:'4px 10px'}}>
  {notice?.bouncedEmail&&<div role="alert">An email to <strong>{notice.bouncedEmail}</strong> bounced. Please check and correct this customer’s email at your earliest convenience. <button type="button" className="gp-btn" onClick={()=>onEditCustomer(notice.customerId)}>Fix email</button></div>}
  <button type="button" className="gp-btn" disabled={!ticketId||!notice?.canRequest||busy} onClick={send}>Send confirmation request</button><HelpPopup label="Send confirmation request">Ask the customer to confirm this appointment now, outside the normal schedule. The saved schedule and their reminder choices stay unchanged. Confirmed or cancelled appointments do not receive another request.</HelpPopup>
  <span role="status">{message?helpfulError(message):readError||notice?.reason||(!ticketId?'Save this appointment first.':!notice?'Checking appointment…':'')}</span>{readError&&<button type="button" className="gp-btn" onClick={()=>setRetry(v=>v+1)}>Try Again</button>}
 </div>;
}
