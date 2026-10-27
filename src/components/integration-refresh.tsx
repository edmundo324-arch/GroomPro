"use client";
import {useEffect} from 'react';
// One poller for the app. It never signs in, renews inactivity, clears a screen,
// or replaces an editor's pending work. Normal module reads enforce permissions.
export function IntegrationRefresh({scope,enabled}:{scope:string;enabled:boolean}){
 useEffect(()=>{
  if(!scope||!enabled)return;
  let disposed=false,pending=false,revision='';const controller=new AbortController();
  const check=async()=>{
   if(disposed||pending||document.visibilityState!=='visible')return;pending=true;
   try{const response=await fetch('/api/integrations/revision',{cache:'no-store',signal:controller.signal});if(!response.ok)return;const data=await response.json();if(disposed||data.scope!==scope)return;if(data.revision&&data.revision!==revision){revision=data.revision;window.dispatchEvent(new Event('groompro:integration-changed'))}}catch{}finally{pending=false}
  };
  void check();const timer=setInterval(check,10000);window.addEventListener('focus',check);
  return()=>{disposed=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',check)};
 },[scope,enabled]);
 return null;
}
