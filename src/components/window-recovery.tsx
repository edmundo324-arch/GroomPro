"use client";
import {useEffect,useRef,useState} from 'react';
const event='groompro:recover-windows';
export function useWindowRecovery(ref:React.RefObject<HTMLElement|null>,recover:()=>void){
 const latest=useRef(recover);latest.current=recover;
 useEffect(()=>{const restore=()=>{const r=ref.current?.getBoundingClientRect();if(r&&r.width&&r.height)latest.current()};window.addEventListener(event,restore);window.dispatchEvent(new Event('groompro:windows-changed'));return()=>{window.removeEventListener(event,restore);window.dispatchEvent(new Event('groompro:windows-changed'))}},[ref]);
}
export function RecoverWindows(){
 const [needed,setNeeded]=useState(false);
 useEffect(()=>{let frame=0;const check=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setNeeded(Array.from(document.querySelectorAll<HTMLElement>('[data-floating-recoverable]')).some(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<0||r.top<0||r.right>document.documentElement.clientWidth||r.bottom>window.innerHeight)})))};const events=['pointerup','pointercancel','keyup','resize','groompro:windows-changed'];events.forEach(e=>window.addEventListener(e,check));check();return()=>{cancelAnimationFrame(frame);events.forEach(e=>window.removeEventListener(e,check))}},[]);
 return needed?<button type="button" data-recover-windows className="gp-btn gp-recover-windows" onClick={()=>{window.dispatchEvent(new Event(event));window.dispatchEvent(new Event('groompro:windows-changed'))}}>Recover windows</button>:null;
}
