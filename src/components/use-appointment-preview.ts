"use client";
import {useCallback,useEffect,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {popupPosition} from '../lib/calendar-interaction';
import {buildHoverDetails,type HoverDetail} from '../lib/calendar-hover-details';

export type AppointmentPreview={ticket:any;x:number;y:number;width:number;touch?:boolean};
export function useAppointmentPreview(settings:any,enabled=true){
 const [hover,setHover]=useState<AppointmentPreview|null>(null),[details,setDetails]=useState<HoverDetail[]>([]);
 const fields=JSON.stringify(settings?.hoverFields||[]);
 const hide=useCallback(()=>{setHover(null);setDetails([])},[]);
 const show=useCallback((ticket:any,element:HTMLElement,touch=false)=>{
  if(!enabled)return;
  const pos=popupPosition(element.getBoundingClientRect(),window.innerWidth,window.innerHeight);
  // Wide list rows may leave no adjacent room; keep the same popup usable.
  const width=pos.width>=200?pos.width:Math.min(320,window.innerWidth-16);
  // Pointer entry followed by keyboard focus can show the same appointment
  // twice. Keep its loaded family and details while moving the popup.
  if(!ticket.id||hover?.ticket.id!==ticket.id)setDetails([]);
  setHover(current=>({ticket:ticket.id&&current&&current.ticket.id===ticket.id?current.ticket:ticket,x:Math.max(8,Math.min(pos.left,window.innerWidth-width-8)),y:pos.top,width,touch}));
 },[enabled,hover?.ticket.id]);
 useEffect(()=>{if(!enabled)hide()},[enabled,hide]);
 useEffect(()=>{const opened=(event:Event)=>{if((event as CustomEvent).detail?.active)hide()};window.addEventListener('groompro:ticket-window-active',opened);return()=>window.removeEventListener('groompro:ticket-window-active',opened)},[hide]);
 useEffect(()=>{
  if(!enabled||!hover)return;
  const ticket=hover.ticket,selected=JSON.parse(fields);
  setDetails(buildHoverDetails({...ticket,customer:{...ticket.customer,phones:ticket.customer?.phones||[]},pets:(ticket.pets||[]).map((entry:any)=>({...entry,pet:{...entry.pet,vaccinations:entry.pet?.vaccinations||[]}})),lines:ticket.lines||[],assignments:ticket.assignments||[],payments:ticket.payments||[]},selected));
  if(!ticket.id||ticket.status==='DRAFT')return;
  const controller=new AbortController();
  employeeFetch('/api/calendar/details?id='+encodeURIComponent(ticket.id),{signal:controller.signal,cache:'no-store'}).then(async response=>{
   if(!response.ok)return;const data=await response.json();if(controller.signal.aborted)return;
   setDetails(data.details||[]);
   if(data.ticket)setHover(current=>current&&current.ticket.id===ticket.id?{...current,ticket:{...current.ticket,...data.ticket}}:current);
  }).catch(()=>{});
  return()=>controller.abort();
 },[hover?.ticket.id,enabled,fields]);
 return {hover,details,show,hide,setHover};
}
