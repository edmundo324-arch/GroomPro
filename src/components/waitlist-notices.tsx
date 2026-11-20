"use client";
import {useEffect,useState} from 'react';
import {deviceFetch} from '../lib/offline-device';
export function WaitlistNotices({onOpen}:{onOpen:()=>void}){
 const [count,setCount]=useState(0);
 useEffect(()=>{let stopped=false,working=false;async function check(){if(working)return;working=true;try{const r=await deviceFetch('/api/waitlist',{cache:'no-store'});if(!r.ok){if(!stopped)setCount(0);return;}const d=await r.json();if(!stopped)setCount((d.rows||[]).filter((r:any)=>r.opening?.slots?.length).length);}catch{}finally{working=false}}
 void check();const timer=setInterval(()=>{if(!document.hidden)void check()},60000);const changed=(e:Event)=>{if(String((e as CustomEvent).detail?.url||'').includes('/api/waitlist'))void check()};window.addEventListener('focus',check);window.addEventListener('groompro:data-changed',changed);return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('groompro:data-changed',changed)};},[]);
 return count?<button type="button" className="gp-btn" onClick={onOpen} aria-label={`${count} waitlist ${count===1?'entry has':'entries have'} possible openings`} data-help="GroomPro found possible openings for these waitlist entries. Open the waitlist and check current availability before contacting a customer. No time is held and no customer has been messaged."><span role="status">{count} waitlist {count===1?'entry has':'entries have'} possible openings</span></button>:null;
}
