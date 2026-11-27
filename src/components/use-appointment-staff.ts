"use client";
import {useEffect,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {scheduledEmployeeIds} from '../lib/appointment-staff';

export function useAppointmentStaff(date:string,locationId:string,active=true){
 const scope=date+'|'+locationId;
 const [state,setState]=useState({scope:'',ids:[] as string[],error:'',ready:false});
 const [revision,setRevision]=useState(0);
 const retry=()=>setRevision(v=>v+1);
 useEffect(()=>{
  const changed=(event:Event)=>{const url=(event as CustomEvent).detail?.url||'';if(/^\/api\/(employee-schedules|schedule-overrides|employees)(?:\?|\/|$)/.test(url))retry()};
  window.addEventListener('groompro:data-changed',changed);
  window.addEventListener('focus',retry);
  return()=>{window.removeEventListener('groompro:data-changed',changed);window.removeEventListener('focus',retry)};
 },[]);
 useEffect(()=>{
  let live=true;
  if(!active||!date||!locationId)return;
  setState({scope,ids:[],error:'',ready:false});
  Promise.all([
   employeeFetch('/api/employee-schedules',{cache:'no-store'}),
   employeeFetch('/api/schedule-overrides?'+new URLSearchParams({start:date,end:date}),{cache:'no-store'})
  ]).then(async responses=>{
   const [weekly,daily]=await Promise.all(responses.map(r=>r.json()));
   if(responses.some(r=>!r.ok)||!Array.isArray(weekly.schedules)||!Array.isArray(daily.overrides))throw Error(weekly.error||daily.error||'Employee schedules could not load.');
   const ids=scheduledEmployeeIds(date,locationId,weekly.schedules,daily.overrides);
   if(live)setState({scope,ids,error:'',ready:true});
  }).catch(error=>{if(live)setState({scope,ids:[],error:error.message||'Employee schedules could not load.',ready:false})});
  return()=>{live=false};
 },[date,locationId,active,revision]);
 const current=state.scope===scope;
 return {ids:current?state.ids:[],ready:current&&state.ready,error:current?state.error:'',retry};
}
