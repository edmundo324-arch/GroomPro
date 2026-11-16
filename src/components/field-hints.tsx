"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {describeField} from '../lib/field-discovery';
export function FieldHints({enabled}:{enabled:boolean}){
 const [hint,setHint]=useState<(NonNullable<ReturnType<typeof describeField>>&{left:number;top:number})|null>(null);
 useEffect(()=>{
  if(!enabled){setHint(null);return;}
  let timer:ReturnType<typeof setTimeout>;
  const show=(event:Event)=>{
   const target=event.target as HTMLElement;if(target.closest('.gp-help-popup'))return;
   clearTimeout(timer);
   if(target.closest('.gp-whiteboard,.gp-action-pin,.gp-help-trigger,.gp-universal-results,[aria-label="Search"],[aria-label="Reorder tabs"]')){setHint(null);return;}
   const element=target.closest<HTMLElement>('label,.gp-label,.gp-pos-account-link,input[aria-label],select[aria-label],textarea[aria-label]');
   if(!element||element.querySelector('.gp-help-trigger')){setHint(null);return;}
   const field=describeField(element);if(!field){setHint(null);return;}
   timer=setTimeout(()=>{const box=element.getBoundingClientRect();setHint({...field,left:Math.max(8,Math.min(box.left,window.innerWidth-328)),top:Math.max(8,Math.min(box.bottom+6,window.innerHeight-220))})},event.type==='pointerover'?500:0);
  };
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setHint(null)};
  const close=()=>{clearTimeout(timer);setHint(null)};
  document.addEventListener('pointerover',show);document.addEventListener('focusin',show);document.addEventListener('keydown',key);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
  return()=>{clearTimeout(timer);document.removeEventListener('pointerover',show);document.removeEventListener('focusin',show);document.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)};
 },[enabled]);
 return enabled&&hint?createPortal(<div className="gp-help-popup" role="tooltip" style={{left:hint.left,top:hint.top}}><header><strong>{hint.name}</strong><button type="button" aria-label="Close help" onClick={()=>setHint(null)}>×</button></header><div>{hint.help}</div><small>Find: {hint.path}</small></div>,document.body):null;
}
