"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {RecoverWindows} from './window-recovery';

export function AppNavigation<T extends string>({modules,active,onSelect,onCalendarView,onRequests}:{
 modules:T[];active:T;onSelect:(value:T)=>void;onCalendarView?:(view:'Day'|'Week'|'Map')=>void;onRequests?:()=>void
}){
 const [open,setOpen]=useState(false),[visibleKeys,setVisibleKeys]=useState<string[]>([]);
 const root=useRef<HTMLDivElement>(null),row=useRef<HTMLElement>(null),more=useRef<HTMLButtonElement>(null);
 const moduleKey=modules.join('|');
 const calendarShortcuts=Boolean(onCalendarView&&modules.some(value=>value==='Calendar'));
 const items=[
  ...(calendarShortcuts?(['Map','Day','Week'] as const).map(view=>({key:view,label:view,compact:true,current:false,select:()=>onCalendarView?.(view)})):[]),
  ...modules.map(module=>({key:module,label:module,compact:module==='Tickets',current:active===module,select:()=>onSelect(module)})),
 ];

 useLayoutEffect(()=>{
  const nav=row.current;
  if(!nav)return;
  const buttons=Array.from(nav.querySelectorAll<HTMLButtonElement>('button[data-nav-key]'));
  const measure=()=>{
   const keys=buttons.filter(button=>button.offsetWidth>0&&button.offsetLeft+button.offsetWidth<=nav.clientWidth)
    .map(button=>button.dataset.navKey!);
   setVisibleKeys(previous=>previous.join('|')===keys.join('|')?previous:keys);
  };
  const observer=new ResizeObserver(measure);
  observer.observe(nav);
  buttons.forEach(button=>observer.observe(button));
  measure();
  return()=>observer.disconnect();
 },[moduleKey,calendarShortcuts]);

 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);more.current?.focus()}
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',key);
  return()=>{
   document.removeEventListener('pointerdown',outside);
   document.removeEventListener('keydown',key);
  };
 },[open]);

 const run=(select:()=>void)=>{select();setOpen(false)};
 const overflow=items.filter(item=>!visibleKeys.includes(item.key));
 return <div ref={root} className="gp-app-navigation">
  <nav ref={row} className="gp-header-menu" aria-label="GroomPro shortcuts">
   {items.map(item=><button type="button" key={item.key} data-nav-key={item.key}
    className={'gp-module'+(item.current?' active':'')+(item.compact?'':' gp-header-secondary')}
    aria-current={item.current?'page':undefined} style={{visibility:visibleKeys.includes(item.key)?undefined:'hidden'}}
    onClick={()=>run(item.select)}>{item.label}</button>)}
  </nav>
  <button ref={more} type="button" className="gp-module gp-header-more" aria-label="More modules"
   aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(value=>!value)}>⋯</button>
  <RecoverWindows/>
  <nav id="groompro-module-menu" aria-label="More GroomPro modules" className="gp-header-overflow" hidden={!open}>
   {overflow.map(item=><button type="button" key={item.key} className={'gp-module'+(item.current?' active':'')}
    aria-current={item.current?'page':undefined} onClick={()=>run(item.select)}>{item.label}</button>)}
   {onRequests&&modules.some(value=>value==='Tickets')&&<button type="button" className="gp-module" onClick={()=>run(onRequests)}>Request</button>}
  </nav>
 </div>;
}
