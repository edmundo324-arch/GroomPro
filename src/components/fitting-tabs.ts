"use client";

import {useLayoutEffect,useRef,useState} from 'react';
import {fittingTabs} from '../lib/fitting-tabs';

export function useFittingTabs<T extends string,E extends HTMLElement=HTMLDivElement>(tabs:T[],required:readonly T[],alwaysOverflow=false){
 const root=useRef<E>(null),measureRow=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState<T[]>(()=>tabs.filter(tab=>required.includes(tab)));
 const tabsKey=JSON.stringify(tabs),requiredKey=JSON.stringify(required);
 useLayoutEffect(()=>{
  const host=root.current,probe=measureRow.current;
  if(!host||!probe)return;
  const keys=JSON.parse(tabsKey) as T[],pinned=JSON.parse(requiredKey) as T[];
  const measure=()=>{
   if(!host.clientWidth)return;
   const widths=new Map([...probe.querySelectorAll<HTMLElement>('[data-tab-width]')].map(el=>[el.dataset.tabWidth as T,el.getBoundingClientRect().width]));
   const overflow=probe.querySelector<HTMLElement>('[data-more-width]')?.getBoundingClientRect().width||0;
   host.style.setProperty('--gp-tab-ideal-width',Math.ceil([...widths.values()].reduce((sum,width)=>sum+width,0))+'px');
   const next=fittingTabs(keys,pinned,widths,host.clientWidth,overflow,alwaysOverflow);
   setVisible(current=>current.length===next.length&&current.every((tab,index)=>tab===next[index])?current:next);
  };
  const observer=new ResizeObserver(measure);
  observer.observe(host);observer.observe(probe);
  measure();
  return()=>observer.disconnect();
 },[tabsKey,requiredKey,alwaysOverflow]);
 return {root,measureRow,visible};
}
