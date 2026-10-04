"use client";
import {useEffect,useRef,useState} from "react";
import {usePinSignIn} from "./use-pin-sign-in";
import {PinRequest} from "../lib/employee-fetch";
export function ActionPin({onSignedIn}:{onSignedIn:(employee:any)=>void}){
 const[open,setOpen]=useState(false);
 const {pin,setPin,error,setError,busy,submit}=usePinSignIn(open,employee=>{onSignedIn(employee);finish(true)});
 useEffect(()=>{let last=0;const activity=()=>{if(Date.now()-last<60000)return;last=Date.now();fetch('/api/employee/session').catch(()=>{})};window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);return()=>{window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity)}},[]);
 const waiting=useRef<PinRequest[]>([]),previous=useRef<HTMLElement|null>(null),dialog=useRef<HTMLDivElement>(null);
 function finish(ok:boolean){const requests=waiting.current.splice(0);setOpen(false);setPin("");requests.forEach(r=>r.complete(ok));previous.current?.focus()}
 useEffect(()=>{const listener=(event:Event)=>{if(!waiting.current.length){previous.current=document.activeElement as HTMLElement;setPin("");setError("")}waiting.current.push((event as CustomEvent<PinRequest>).detail);setOpen(true)};window.addEventListener("groompro:request-pin",listener);return()=>{window.removeEventListener("groompro:request-pin",listener);waiting.current.splice(0).forEach(r=>r.complete(false))}},[]);

 if(!open)return null;
 return <div className="gp-modal-backdrop gp-action-pin" onKeyDown={e=>{if(e.key==="Escape"&&!busy)finish(false);if(e.key==="Tab"){const items=dialog.current?.querySelectorAll<HTMLElement>("input,button:not(:disabled)");if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}><div ref={dialog} className="gp-pin-window" role="dialog" aria-modal="true" aria-labelledby="action-pin-title"><h2 id="action-pin-title">Employee PIN</h2><p>Enter your PIN to finish this action.</p><form onSubmit={e=>{e.preventDefault();submit()}}><input aria-label="Employee PIN" autoFocus autoComplete="off" type="password" inputMode="numeric" maxLength={10} className="gp-search-input" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/>{error&&<p role="alert" className="gp-form-error">{error}</p>}<div className="gp-modal-actions"><button type="button" className="gp-btn" disabled={busy} onClick={()=>finish(false)}>Cancel</button><button className="gp-btn primary" disabled={busy}>{busy?"Signing in…":"Continue"}</button></div></form></div></div>;
}

