"use client";
import {useEffect,useRef,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
// Each mounted view owns its override; it is never written to business settings.
export function usePetVisibility(instance?:string){
 const [showInactive,setValue]=useState(false),override=useRef(false);
 useEffect(()=>{let live=true;override.current=false;setValue(false);employeeFetch('/api/workflow-settings').then(r=>r.ok?r.json():null).then(d=>{if(live&&!override.current)setValue(d?.businessSettings?.showInactivePets===true)}).catch(()=>{});return()=>{live=false}},[instance]);
 return {showInactive,setShowInactive:(value:boolean)=>{override.current=true;setValue(value)}};
}
