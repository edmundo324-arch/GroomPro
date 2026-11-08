"use client";
import {useVisualRoot} from './visual-layout-studio';
import {useWindowRecovery} from './window-recovery';
import {usePreferenceScope} from './floating-editor-window';
import {fitWindow,dragWindow,defaultPosGeometry,posWindowOrientation,posWindowPreferenceKey,validWindowGeometry,type PosOrientation,type WindowGeometry} from '../lib/window-geometry';
import {createContext,useContext,useLayoutEffect,useRef,useState} from 'react';

type Placement={geometry:WindowGeometry;full:boolean};
type Drag=WindowGeometry&{x:number;y:number;resize:boolean;orientation:PosOrientation;moved:boolean};
const placements=new Map<string,Placement>();
const WindowContext=createContext({full:false,toggle:()=>{}});
const orientation=()=>posWindowOrientation(document.documentElement.clientWidth,window.innerHeight);
const fullGeometry=()=>({left:8,top:8,width:document.documentElement.clientWidth-16,height:window.innerHeight-16});

function readPlacement(scope:string,direction:PosOrientation){
 const key=posWindowPreferenceKey(scope,direction),memory=placements.get(key||direction);
 if(memory||!key)return memory;
 try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(validWindowGeometry(saved?.geometry)&&typeof saved.full==='boolean'){
   placements.set(key,saved);
   return saved as Placement;
  }
 }catch{}
}
function rememberPlacement(scope:string,direction:PosOrientation,value:Placement){
 const key=posWindowPreferenceKey(scope,direction);
 placements.set(key||direction,value);
 if(key)try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}

export function PosFullSizeButton(){
 const ctx=useContext(WindowContext);
 return <button className="gp-btn" onClick={ctx.toggle}>{ctx.full?'Restore Size':'Full Size'}</button>;
}

export function PosWindowFrame({children,active=true,className='',style}:{children:React.ReactNode;active?:boolean;className?:string;style?:React.CSSProperties}){
 const scope=usePreferenceScope(),root=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
 const [full,setFull]=useState(false);
 useVisualRoot(root,'POS Ticket',active);

 function geometry(){
  const {left,top,width,height}=root.current!.getBoundingClientRect();
  return {left,top,width,height};
 }
 function apply(value:WindowGeometry,custom:boolean,offscreen=true){
  const el=root.current;
  if(!el)return;
  const width=document.documentElement.clientWidth,height=window.innerHeight;
  const fitted=offscreen?dragWindow({...value,width:Math.min(value.width,width-16),height:Math.min(value.height,height-16)},width,height):fitWindow(value,width,height);
  el.toggleAttribute('data-pos-custom-placement',custom);
  for(const key of ['left','top','width','height'] as const)el.style[key]=fitted[key]+'px';
  el.style.right='auto';
  el.style.bottom='auto';
  el.style.margin='0';
 }
 useLayoutEffect(()=>{
  if(!active)return;
  const resize=()=>{
   const direction=orientation();
   if(drag.current?.orientation===direction)return;
   drag.current=null;
   const saved=readPlacement(scope,direction);
   if(saved?.full)apply(fullGeometry(),true);
   else apply(saved?.geometry||defaultPosGeometry(document.documentElement.clientWidth,window.innerHeight),!!saved);
   setFull(saved?.full===true);
  };
  resize();
  const observer=new ResizeObserver(resize);
  observer.observe(document.documentElement);
  window.addEventListener('resize',resize);
  return()=>{observer.disconnect();window.removeEventListener('resize',resize)};
 },[active,scope]);
 useWindowRecovery(root,()=>{
  const direction=orientation();
  if(readPlacement(scope,direction)?.full)return;
  apply(geometry(),true,false);
  rememberPlacement(scope,direction,{geometry:geometry(),full:false});
 });

 function toggle(){
  const direction=orientation(),saved=readPlacement(scope,direction);
  const next={geometry:full&&saved?saved.geometry:geometry(),full:!full};
  rememberPlacement(scope,direction,next);
  apply(next.full?fullGeometry():next.geometry,true);
  setFull(next.full);
 }
 function start(e:React.PointerEvent<HTMLDivElement>){
  if(full)return;
  const target=e.target as Element,resize=!!target.closest('[data-pos-resize]');
  if(target.closest('.gp-editor-window'))return;
  if(!resize&&(!target.closest('.gp-floating-head')||target.closest('button,input,select,textarea')))return;
  e.preventDefault();
  drag.current={...geometry(),x:e.clientX,y:e.clientY,resize,orientation:orientation(),moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent<HTMLDivElement>){
  const d=drag.current;
  if(!d||d.orientation!==orientation())return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(!d.moved&&!dx&&!dy)return;
  d.moved=true;
  if(d.resize){
   apply({...d,width:Math.max(Math.min(650,window.innerWidth-16),d.width+dx),height:Math.max(Math.min(400,window.innerHeight-16),d.height+dy)},true,false);
  }else apply({...d,left:d.left+dx,top:d.top+dy},true);
 }
 function finish(e:React.PointerEvent<HTMLDivElement>){
  const d=drag.current;
  if(d?.moved&&d.orientation===orientation())rememberPlacement(scope,d.orientation,{geometry:geometry(),full:false});
  drag.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }

 return <WindowContext.Provider value={{full,toggle}}>
  <div ref={root} data-pos-active={active} data-floating-recoverable className={"gp-floating-window gp-ticket-window gp-pos-window gp-pos-adjustable "+className}
   role="dialog" aria-label="POS Ticket" style={{...style,resize:'none'}} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
   {children}{!full&&<span data-pos-resize="true" className="gp-pos-resize" title="Drag to resize POS Ticket" aria-hidden="true">◢</span>}
  </div>
 </WindowContext.Provider>;
}
