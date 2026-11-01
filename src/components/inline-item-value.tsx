"use client";
import {useEffect,useRef,useState,ReactNode} from 'react';

// Keep the existing editor and its save handlers; touch layouts reveal it on demand.
export function InlineItemValue({value,label,disabled,children}:{value:string;label:string;disabled?:boolean;children:ReactNode}){
 const [editing,setEditing]=useState(false),root=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(editing)root.current?.querySelector<HTMLElement>('input,select')?.focus()},[editing]);
 return <span ref={root} className={'gp-inline-item-value'+(editing?' is-editing':'')} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setEditing(false)}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();root.current?.querySelector<HTMLElement>('input,select')?.blur();setEditing(false)}}}>
  <button type="button" className="gp-inline-value-text" disabled={disabled} aria-label={'Edit '+label+': '+value} onClick={()=>setEditing(true)}>{value}</button>
  <span className="gp-inline-value-editor">{children}</span>
 </span>;
}
