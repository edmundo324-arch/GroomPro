"use client";
import {useEffect,useRef,useState} from 'react';
import {RecoverWindows} from './window-recovery';
export function AppNavigation<T extends string>({modules,active,onSelect,onCalendarView,onRequests}:{modules:T[];active:T;onSelect:(value:T)=>void;onCalendarView?:(view:'Day'|'Week'|'Map')=>void;onRequests?:()=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[open]);
 const quickLinks=[['Calendar','Appointments'],['Customers','Clients'],['Pets','Pets'],['Messaging','Messages']] as const;
 function select(module:string){
  const target=modules.find(value=>value===module);
  if(target){onSelect(target);setOpen(false)}
 }
 return <div ref={root} className="gp-app-navigation"><nav className="gp-mobile-top" aria-label="Calendar shortcuts">
  {onCalendarView&&modules.some(value=>value==='Calendar')&&<><button type="button" onClick={()=>onCalendarView('Map')}>Map</button><button type="button" onClick={()=>onCalendarView('Day')}>Day</button><button type="button" onClick={()=>onCalendarView('Week')}>Week</button></>}
  {modules.some(value=>value==='Tickets')&&<button type="button" onClick={()=>select('Tickets')}>Tickets</button>}
 </nav><div className="gp-navigation-tools"><button ref={toggle} type="button" className="gp-btn gp-navigation-toggle" aria-label="Open GroomPro menu" aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(v=>!v)}>☰ <span>{active}</span></button><RecoverWindows/></div><nav className="gp-mobile-bottom" aria-label="Quick navigation">
  {quickLinks.slice(0,3).filter(([module])=>modules.some(value=>value===module)).map(([module,label])=><button type="button" key={module} aria-current={active===module?'page':undefined} onClick={()=>select(module)}>{label}</button>)}
  {onRequests&&modules.some(value=>value==='Tickets')&&<button type="button" onClick={onRequests}>Request</button>}
  {modules.some(value=>value==='Messaging')&&<button type="button" onClick={()=>select('Messaging')}>Messages</button>}
  <button type="button" aria-label="More modules" aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(value=>!value)}>⋯</button>
 </nav><nav id="groompro-module-menu" aria-label="GroomPro modules" className={'gp-module-nav'+(open?' is-open':'')}>{modules.map(m=><button type="button" key={m} className={'gp-module'+(active===m?' active':'')} aria-current={active===m?'page':undefined} onClick={()=>{onSelect(m);setOpen(false)}}>{m}</button>)}</nav></div>;
}
