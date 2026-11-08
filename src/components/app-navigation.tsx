"use client";
import {useEffect,useRef,useState} from 'react';
import {useFittingTabs} from './fitting-tabs';
import {RecoverWindows} from './window-recovery';

export function AppNavigation<T extends string>({modules,active,onSelect,onCalendarView,onRequests}:{
 modules:T[];active:T;onSelect:(value:T)=>void;onCalendarView?:(view:'Day'|'Week'|'Map')=>void;onRequests?:()=>void
}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),more=useRef<HTMLButtonElement>(null);
 const calendarShortcuts=Boolean(onCalendarView&&modules.some(value=>value==='Calendar'));
 const items=[
  ...(calendarShortcuts?(['Map','Day','Week'] as const).map(view=>({key:view,label:view,current:false,select:()=>onCalendarView?.(view)})):[]),
  ...[...modules.filter(module=>module==='Tickets'),...modules.filter(module=>module!=='Tickets')]
   .map(module=>({key:module,label:module,current:active===module,select:()=>onSelect(module)})),
  ...(onRequests&&modules.some(value=>value==='Tickets')?[{key:'Request',label:'Request',current:false,select:onRequests}]:[]),
 ];
 const {root:row,measureRow,visible:visibleKeys}=useFittingTabs<string,HTMLElement>(items.map(item=>item.key),['Map','Day','Week','Tickets']);

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
  <nav ref={row} className="gp-header-menu gp-fitting-tabs" aria-label="GroomPro shortcuts">
   <div ref={measureRow} className="gp-tab-measure" aria-hidden="true">
    {items.map(item=><button type="button" tabIndex={-1} key={item.key} data-tab-width={item.key} className="gp-module">{item.label}</button>)}
    <button type="button" tabIndex={-1} data-more-width className="gp-module gp-header-more">⋯</button>
   </div>
   {items.filter(item=>visibleKeys.includes(item.key)).map(item=><button type="button" key={item.key}
    className={'gp-module'+(item.current?' active':'')}
    aria-current={item.current?'page':undefined}
    onClick={()=>run(item.select)}>{item.label}</button>)}
   {overflow.length>0&&<button ref={more} type="button" className="gp-module gp-header-more" aria-label="More modules"
    aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(value=>!value)}>⋯</button>}
  </nav>
  <RecoverWindows/>
  <nav id="groompro-module-menu" aria-label="More GroomPro modules" className="gp-header-overflow" hidden={!open||!overflow.length}>
   {overflow.map(item=><button type="button" key={item.key} className={'gp-module'+(item.current?' active':'')}
    aria-current={item.current?'page':undefined} onClick={()=>run(item.select)}>{item.label}</button>)}
  </nav>
 </div>;
}
