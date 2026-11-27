"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {sideHintPlacement,hintTargets,targetsBox} from '../lib/hint-placement';
import {describeCustomerField} from '../lib/customer-field-purpose';
import {describeField} from '../lib/field-discovery';
export function FieldHints({enabled,customer=false}:{enabled:boolean;customer?:boolean}){
 const [hint,setHint]=useState<(NonNullable<ReturnType<typeof describeField>>&{left:number;top:number;width:number;maxHeight:number})|null>(null);
 useEffect(()=>{
  if(!enabled){setHint(null);return;}
  const describe=customer?describeCustomerField:describeField;
  let timer:ReturnType<typeof setTimeout>;
  const show=(event:Event)=>{
   const target=event.target as HTMLElement;if(target.closest('.gp-help-popup'))return;
   clearTimeout(timer);
   if(target.closest('.gp-whiteboard,.gp-action-pin,.gp-help-trigger,.gp-universal-results,[aria-label="Search"],[aria-label="Reorder Menu"]')){setHint(null);return;}
   const element=target.closest<HTMLElement>('label,.gp-label,.gp-pos-account-link,input[aria-label],select[aria-label],textarea[aria-label]');
   if(!element||element.querySelector('.gp-help-trigger')||element.closest('label')?.querySelector('.gp-help-trigger')){setHint(null);return;}
   const field=describe(element);if(!field){setHint(null);return;}
   timer=setTimeout(()=>{const latest=describe(element);if(!latest||(!latest.help.trim()&&!latest.relatedPath?.trim())){setHint(null);return;}const position=sideHintPlacement(targetsBox(hintTargets(element)),{width:window.innerWidth,height:window.innerHeight});setHint({...latest,...position})},event.type==='pointerover'?500:0);
  };
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){clearTimeout(timer);setHint(null)}};
  const leave=(e:PointerEvent)=>{if(!e.relatedTarget){clearTimeout(timer);setHint(null)}};
  const close=(event?:Event)=>{if(event?.target instanceof Element&&event.target.closest('.gp-help-popup'))return;clearTimeout(timer);setHint(null)};
  document.addEventListener('pointerover',show);document.addEventListener('pointerout',leave);document.addEventListener('focusin',show);document.addEventListener('change',show);document.addEventListener('keydown',key);window.addEventListener('blur',close);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
  return()=>{clearTimeout(timer);document.removeEventListener('pointerover',show);document.removeEventListener('pointerout',leave);document.removeEventListener('focusin',show);document.removeEventListener('change',show);document.removeEventListener('keydown',key);window.removeEventListener('blur',close);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)};
 },[enabled,customer]);
 useEffect(()=>{if(!enabled||!hint)return;const targets=hintTargets(hint.element);targets.forEach(t=>t.classList.add('gp-hint-target'));return()=>targets.forEach(t=>t.classList.remove('gp-hint-target'))},[enabled,hint]);
 return enabled&&hint?createPortal(<div className="gp-help-popup" role="tooltip" style={{left:hint.left,top:hint.top,width:hint.width,maxHeight:hint.maxHeight}}><header><strong>{hint.name}</strong><button type="button" aria-label="Close help" onClick={()=>setHint(null)}>×</button></header><div>{hint.help}</div>{!customer&&hint.relatedPath&&<small>Find: {hint.relatedPath}</small>}</div>,document.body):null;
}
