"use client";
import {useEffect,useRef,useState} from 'react';
import {RecoverWindows} from './window-recovery';
export function AppNavigation<T extends string>({modules,active,onSelect}:{modules:T[];active:T;onSelect:(value:T)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[open]);
 return <div ref={root} className="gp-app-navigation"><div className="gp-navigation-tools"><button ref={toggle} type="button" className="gp-btn gp-navigation-toggle" aria-label="Open GroomPro menu" aria-expanded={open} aria-controls="groompro-module-menu" onClick={()=>setOpen(v=>!v)}>☰ <span>{active}</span></button><RecoverWindows/></div><nav id="groompro-module-menu" aria-label="GroomPro modules" className={'gp-module-nav'+(open?' is-open':'')}>{modules.map(m=><button type="button" key={m} className={'gp-module'+(active===m?' active':'')} aria-current={active===m?'page':undefined} onClick={()=>{onSelect(m);setOpen(false)}}>{m}</button>)}</nav></div>;
}
