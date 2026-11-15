"use client";
import {useLayoutEffect,useState,type ReactNode} from 'react';
import {usePreferenceScope} from './floating-editor-window';

export function FormDisclosure({section,summary,children}:{section:string;summary:ReactNode;children:ReactNode}){
 const scope=usePreferenceScope();
 const key=scope?'groompro:form-section:'+scope+':'+section:'';
 const [open,setOpen]=useState(false);
 useLayoutEffect(()=>{
  try{setOpen(!!key&&localStorage.getItem(key)==='open');}
  catch{setOpen(false);}
 },[key]);
 return <details open={open}>
  <summary onClick={event=>{
   event.preventDefault();
   const next=!open;
   setOpen(next);
   if(key)try{localStorage.setItem(key,next?'open':'closed');}catch{}
  }}>{summary}</summary>
  {children}
 </details>;
}