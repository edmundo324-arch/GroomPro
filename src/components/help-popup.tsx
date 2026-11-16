"use client";
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {employeeFetch} from '../lib/employee-fetch';
import './help-popup.css';
import {FieldHints} from './field-hints';
const Hints=createContext(true);
export function HelpfulHints({children,excluded=false}:{children:ReactNode;excluded?:boolean}){
 const [enabled,setEnabled]=useState(true);
 useEffect(()=>{let live=true;const refresh=()=>employeeFetch('/api/helpful-hints').then(r=>r.ok?r.json():null).then(d=>{if(live&&d)setEnabled(d.enabled!==false)}).catch(()=>{});void refresh();window.addEventListener('groompro:appearance-changed',refresh);return()=>{live=false;window.removeEventListener('groompro:appearance-changed',refresh)}},[]);
 return <Hints.Provider value={!excluded&&enabled}>{children}<FieldHints enabled={!excluded&&enabled}/></Hints.Provider>;
}
export function HelpPopup({label,children}:{label:string;children:ReactNode}){
 const enabled=useContext(Hints),id=useId(),anchor=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null),[pinned,setPinned]=useState(false);
 function show(){const r=anchor.current?.getBoundingClientRect();if(r)setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-328)),top:Math.max(8,Math.min(r.bottom+6,window.innerHeight-220))});}
 useEffect(()=>{if(!position)return;const close=()=>{setPosition(null);setPinned(false)};const outside=(e:PointerEvent)=>{if(!anchor.current?.contains(e.target as Node)&&!popup.current?.contains(e.target as Node))close()};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close();anchor.current?.focus({preventScroll:true})}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',close);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close)}},[position]);
 if(!enabled)return null;
 return <><button ref={anchor} type="button" className="gp-help-trigger" aria-label={'Help with '+label} aria-expanded={!!position} aria-controls={position?id:undefined} onPointerEnter={e=>{if(e.pointerType==='mouse')show()}} onPointerLeave={()=>{if(!pinned)setPosition(null)}} onFocus={show} onBlur={()=>{if(!pinned)setPosition(null)}} onClick={e=>{e.preventDefault();if(pinned){setPosition(null);setPinned(false)}else{show();setPinned(true)}}}>?</button>{position&&createPortal(<div ref={popup} id={id} role={pinned?'dialog':'tooltip'} aria-label={label} className="gp-help-popup" style={position}><header><strong>{label}</strong>{pinned&&<button type="button" aria-label="Close help" onClick={()=>{setPosition(null);setPinned(false)}}>×</button>}</header><div>{children}</div></div>,document.body)}</>;
}
