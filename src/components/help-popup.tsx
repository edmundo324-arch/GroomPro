"use client";
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {employeeFetch} from '../lib/employee-fetch';
import './help-popup.css';
import {sideHintPlacement,hintTargets,targetsBox} from '../lib/hint-placement';
import {hintHighlightColor,defaultHintHighlightColor} from '../lib/hint-appearance';
import {FieldHints} from './field-hints';
import type {PublicHintSettings} from '../lib/public-hint-settings';
const Hints=createContext(true);
export function CustomerHelpfulHints({children,settings}:{children:ReactNode;settings?:PublicHintSettings}){
 const enabled=settings?.enabled===true,color=hintHighlightColor(settings?.highlightColor);
 useEffect(()=>{const root=document.documentElement,old=root.style.getPropertyValue('--gp-hint-highlight');root.style.setProperty('--gp-hint-highlight',color);return()=>{if(old)root.style.setProperty('--gp-hint-highlight',old);else root.style.removeProperty('--gp-hint-highlight')}},[color]);
 return <Hints.Provider value={enabled}>{children}<FieldHints enabled={enabled} customer/></Hints.Provider>;
}
export function HelpfulHints({children,excluded=false}:{children:ReactNode;excluded?:boolean}){
 const [enabled,setEnabled]=useState(true),[color,setColor]=useState(defaultHintHighlightColor);
 useEffect(()=>{const root=document.documentElement,old=root.style.getPropertyValue('--gp-hint-highlight');root.style.setProperty('--gp-hint-highlight',color);return()=>{if(old)root.style.setProperty('--gp-hint-highlight',old);else root.style.removeProperty('--gp-hint-highlight')}},[color]);
 useEffect(()=>{let live=true;const refresh=()=>employeeFetch('/api/helpful-hints').then(r=>r.ok?r.json():null).then(d=>{if(live&&d){setEnabled(d.enabled!==false);setColor(hintHighlightColor(d.highlightColor))}}).catch(()=>{});void refresh();window.addEventListener('groompro:appearance-changed',refresh);return()=>{live=false;window.removeEventListener('groompro:appearance-changed',refresh)}},[]);
 return <Hints.Provider value={!excluded&&enabled}>{children}<FieldHints enabled={!excluded&&enabled}/></Hints.Provider>;
}
export function HelpPopup({label,children}:{label:string;children:ReactNode}){
 const enabled=useContext(Hints),id=useId(),anchor=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),restoringFocus=useRef(false);
 const [position,setPosition]=useState<ReturnType<typeof sideHintPlacement>|null>(null),[pinned,setPinned]=useState(false);
 function show(){if(anchor.current)setPosition(sideHintPlacement(targetsBox(hintTargets(anchor.current)),{width:window.innerWidth,height:window.innerHeight}));}
 useEffect(()=>{if(!enabled||!position||!anchor.current)return;const targets=hintTargets(anchor.current);targets.forEach(t=>t.classList.add('gp-hint-target'));return()=>targets.forEach(t=>t.classList.remove('gp-hint-target'))},[enabled,position]);
 useEffect(()=>{if(!position)return;const close=()=>{setPosition(null);setPinned(false)};const outside=(e:PointerEvent)=>{if(!anchor.current?.contains(e.target as Node)&&!popup.current?.contains(e.target as Node))close()};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close();restoringFocus.current=document.activeElement!==anchor.current;anchor.current?.focus({preventScroll:true})}};const scroll=(e:Event)=>{if(!popup.current?.contains(e.target as Node))close()};window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close)}},[position]);
 const emptyCopy=children==null||typeof children==='boolean'||(typeof children==='string'&&(!children.trim()||children.trim().toLowerCase()===label.trim().toLowerCase()));
 if(!enabled||emptyCopy)return null;
 return <><button ref={anchor} type="button" className="gp-help-trigger" aria-label={'Help with '+label} aria-expanded={!!position} aria-controls={position?id:undefined} onPointerEnter={e=>{if(e.pointerType==='mouse')show()}} onPointerLeave={()=>{if(!pinned)setPosition(null)}} onFocus={()=>{if(restoringFocus.current){restoringFocus.current=false;return}show()}} onBlur={()=>{if(!pinned)setPosition(null)}} onClick={e=>{e.preventDefault();if(pinned){setPosition(null);setPinned(false)}else{show();setPinned(true)}}}>?</button>{enabled&&position&&createPortal(<div ref={popup} id={id} role={pinned?'dialog':'tooltip'} aria-label={label} className="gp-help-popup" style={position}><header><strong>{label}</strong>{pinned&&<button type="button" aria-label="Close help" onClick={()=>{setPosition(null);setPinned(false)}}>×</button>}</header><div>{children}</div></div>,document.body)}</>;
}
