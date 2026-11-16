"use client";
import {useEffect,useRef,useState} from 'react';
import {useFittingTabs} from './fitting-tabs';
import {NavigationTools} from './navigation-tools';
import {usePreferenceScope} from './floating-editor-window';
import {RecoverWindows} from './window-recovery';

const moduleIcons:Record<string,string>={
 Tickets:'M5 3h14v18l-3-2-4 2-4-2-3 2V3zM8 8h8m-8 4h8m-8 4h5',
 Customers:'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-4m-3-7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm2-4a4 4 0 0 1 0 8',
 Pets:'M8 4c2 0 3 4 1 5-2 1-3-5-1-5zm8 0c2 0 1 6-1 5-2-1-1-5 1-5zM4 9c2 0 3 4 1 5-2 0-3-5-1-5zm16 0c2 0 1 5-1 5-2-1-1-5 1-5zM7 18c0-3 4-6 5-6s5 3 5 6c0 3-4 2-5 2s-5 1-5-2z',
 Whiteboard:'M3 4h18v13H3zM12 17v4m-4 0h8M7 8h6m-6 4h9',
 Messaging:'M4 4h16v12h-9l-5 4v-4H4zM8 8h8m-8 4h5',
 Inventory:'M3 7h18v13H3zM3 13h18M8 7v13m8-13v13M6 4h12',
 Reports:'M4 3v17h17M8 16v-4m5 4V8m5 8V5',
 Services:'M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12l1 1 2-2m2 1h3m-8 4h8',
 Products:'M5 8h14l1 13H4zM9 9V6a3 3 0 0 1 6 0v3',
 Packages:'M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0 9 4 9-4m-9 4v10M7 5l9 4',
 'VIP Memberships':'M3 5h18v14H3zM12 7l1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5L7 10.5l3.5-.5z',
 Schedule:'M4 6h16v15H4zM8 3v5m8-5v5M4 10h16m-8 3v3l2 1',
 Settings:'M4 6h4m4 0h8M4 12h10m4 0h2M4 18h4m4 0h8M8 4h4v4H8zm6 6h4v4h-4zm-6 6h4v4H8z',
 Request:'M5 3h10l4 4v14H5zM14 3v5h5m-7 3v6m-3-3h6',
};
function ModuleLabel({name}:{name:string}){
 const icon=moduleIcons[name];
 return <>{icon&&<svg className="gp-module-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>}{name}</>;
}

export function AppNavigation<T extends string>({modules,active,onSelect,onCalendarView,onRequests,role}:{
 role?:string;modules:T[];active:T;onSelect:(value:T)=>void;onCalendarView?:(view:'Day'|'Week'|'Map')=>void;onRequests?:()=>void
}){
 const [open,setOpen]=useState(false);
 const scope=usePreferenceScope(),[order,setOrder]=useState<string[]>([]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('groompro:menu-order:'+scope)||'[]');setOrder(Array.isArray(saved)?saved.filter(v=>typeof v==='string'):[])}catch{setOrder([])}},[scope]);
 function reorder(next:string[]){setOrder(next);if(scope)try{localStorage.setItem('groompro:menu-order:'+scope,JSON.stringify(next))}catch{}};
 const root=useRef<HTMLDivElement>(null),more=useRef<HTMLButtonElement>(null);
 const calendarShortcuts=Boolean(onCalendarView&&modules.some(value=>value==='Calendar'));
 const navigationModules=calendarShortcuts?modules.filter(module=>module!=='Calendar'):modules;
 const defaultItems=[
  ...(calendarShortcuts?(['Map','Day','Week'] as const).map(view=>({key:view,label:view,current:false,select:()=>onCalendarView?.(view)})):[]),
  ...[...navigationModules.filter(module=>module==='Tickets'),...navigationModules.filter(module=>module!=='Tickets')]
   .map(module=>({key:module,label:module,current:active===module,select:()=>onSelect(module)})),
  ...(onRequests&&modules.some(value=>value==='Tickets')?[{key:'Request',label:'Request',current:false,select:onRequests}]:[]),
 ];
 const items=[...defaultItems].sort((a,b)=>{const x=order.indexOf(a.key),y=order.indexOf(b.key);return (x<0?order.length+defaultItems.indexOf(a):x)-(y<0?order.length+defaultItems.indexOf(b):y)});
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
    {items.map(item=><button type="button" tabIndex={-1} key={item.key} data-tab-width={item.key} className="gp-module"><ModuleLabel name={item.label}/></button>)}
    <button type="button" tabIndex={-1} data-more-width className="gp-module gp-header-more">⋯</button>
   </div>
   {items.filter(item=>visibleKeys.includes(item.key)).map(item=><button type="button" key={item.key}
    className={'gp-module'+(item.current?' active':'')}
    aria-current={item.current?'page':undefined}
    onClick={()=>run(item.select)}><ModuleLabel name={item.label}/></button>)}
   {overflow.length>0&&<button ref={more} type="button" className="gp-module gp-header-more" aria-label="More modules"
    aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(value=>!value)}>⋯</button>}
  </nav>
  <RecoverWindows/><NavigationTools items={items} order={order} onOrder={reorder} onSelect={value=>{if(modules.includes(value as T))onSelect(value as T)}} role={role}/>
  <nav id="groompro-module-menu" aria-label="More GroomPro modules" className="gp-header-overflow" hidden={!open||!overflow.length}>
   {overflow.map(item=><button type="button" key={item.key} className={'gp-module'+(item.current?' active':'')}
    aria-current={item.current?'page':undefined} onClick={()=>run(item.select)}><ModuleLabel name={item.label}/></button>)}
  </nav>
 </div>;
}
