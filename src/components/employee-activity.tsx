"use client";
import {useEffect,useRef} from 'react';

type SessionEmployee={id:string;role:string;firstName:string;lastName:string;displayName?:string|null};
const identityFields=['id','role','firstName','lastName','displayName'] as const;

// Background polling does not count as staff activity.
export function EmployeeActivity<T extends SessionEmployee>({employee,scope,onExpired,onEmployeeChange}:{employee:T|null;scope:string;onExpired:()=>void;onEmployeeChange:(employee:T)=>void}){
 const current=useRef(employee);
 current.current=employee;
 useEffect(()=>{
  if(!employee)return;
  const controller=new AbortController();
  let lastSent=0,lastIdentityCheck=0,pending=false;
  const activity=(event:Event)=>{
   if(!event.isTrusted||document.visibilityState!=='visible'||!navigator.onLine||pending||Date.now()-lastSent<5000)return;
   pending=true;
   lastSent=Date.now();
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);
   void fetch('/api/employee/activity',{method:'POST',credentials:'same-origin',cache:'no-store',signal}).then(async response=>{
    if(signal.aborted||current.current!==employee)return;
    if(response.status===401){onExpired();return;}
    if(!response.ok||Date.now()-lastIdentityCheck<60000)return;
    lastIdentityCheck=Date.now();
    const session=await fetch('/api/employee/session',{cache:'no-store',signal});
    if(!session.ok)return;
    const {employee:confirmed}=await session.json() as {employee:SessionEmployee|null};
    if(confirmed&&!signal.aborted&&current.current===employee&&identityFields.some(key=>(confirmed[key]??'')!==(employee[key]??''))){
     onEmployeeChange({...employee,...confirmed});
    }
   }).catch(()=>{}).finally(()=>{pending=false});
  };
  const events=['pointerdown','keydown','input','wheel','touchmove','click'];
  events.forEach(name=>document.addEventListener(name,activity,{capture:true,passive:true}));
  return()=>{
   controller.abort();
   events.forEach(name=>document.removeEventListener(name,activity,true));
  };
 },[employee,scope,onExpired,onEmployeeChange]);
 return null;
}