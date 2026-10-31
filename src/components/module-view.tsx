"use client";
import {useVisualRoot} from './visual-layout-studio';
import {createContext,useContext,useLayoutEffect,useRef,useEffect,useState} from 'react';
const VisibleModule=createContext(true);
export const useModuleVisible=()=>useContext(VisibleModule);
// Nested retained sections use the same visibility contract without changing page scroll.
export function RetainedSection({active,visited,children}:{active:boolean;visited:boolean;children:React.ReactNode}){
 const parentVisible=useModuleVisible();
 return visited?<VisibleModule.Provider value={parentVisible&&active}>{children}</VisibleModule.Provider>:null;
}
export function ModuleView({active,children,name=''}:{active:boolean;children:React.ReactNode;name?:string}){
 const visualRoot=useRef<HTMLDivElement>(null);useVisualRoot(visualRoot,name,active);
 const visited=useRef(active),scroll=useRef({x:0,y:0});if(active)visited.current=true;
 useLayoutEffect(()=>{if(!active)return;window.scrollTo(scroll.current.x,scroll.current.y);const remember=()=>{scroll.current={x:window.scrollX,y:window.scrollY}};window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember)},[active]);
 return visited.current?<VisibleModule.Provider value={active}><div ref={visualRoot} hidden={!active} style={active?{display:'contents'}:{display:'none'}}>{children}</div></VisibleModule.Provider>:null;
}

// Visible retained screens refresh on return/focus and relevant confirmed writes.
export function useModuleRefresh(paths:string[]){
 const visible=useModuleVisible(),[revision,setRevision]=useState(0),pathKey=paths.join('|');
 useEffect(()=>{if(!visible)return;const refresh=()=>setRevision(v=>v+1);window.addEventListener('groompro:integration-changed',refresh);return()=>window.removeEventListener('groompro:integration-changed',refresh)},[visible]);
 useEffect(()=>{if(!visible)return;const refresh=()=>setRevision(v=>v+1);const changed=(event:Event)=>{const url=(event as CustomEvent).detail?.url||'';if(pathKey.split('|').some(p=>url.startsWith(p)))refresh()};window.addEventListener('focus',refresh);window.addEventListener('groompro:data-changed',changed);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('groompro:data-changed',changed)}},[visible,pathKey]);
 return {visible,revision};
}
