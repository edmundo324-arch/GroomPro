"use client";
import {useEffect} from 'react';

// Only real interaction renews inactivity. Polling, timers and focus alone do not.
export function EmployeeActivity(){
 useEffect(()=>{
  let lastSent=0,pending=false,disposed=false;
  const activity=(event:Event)=>{
   if(!event.isTrusted||document.visibilityState!=='visible'||pending||Date.now()-lastSent<10000)return;
   pending=true;lastSent=Date.now();
   void fetch('/api/employee/activity',{method:'POST',credentials:'same-origin'}).catch(()=>{}).finally(()=>{if(!disposed)pending=false});
  };
  const events=['pointerdown','keydown','input','wheel'];
  events.forEach(name=>document.addEventListener(name,activity,{capture:true,passive:true}));
  return()=>{disposed=true;events.forEach(name=>document.removeEventListener(name,activity,true))};
 },[]);
 return null;
}
