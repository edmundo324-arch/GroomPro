"use client";
import {useLayoutEffect,type RefObject} from 'react';

export function useNeutralFormFocus(root:RefObject<HTMLElement|null>,open:boolean){
 useLayoutEffect(()=>{
  if(open&&root.current&&!root.current.contains(document.activeElement)){
   root.current.focus({preventScroll:true});
  }
 },[root,open]);
}