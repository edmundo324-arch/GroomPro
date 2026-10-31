"use client";
import {useVisualRoot,visualWindowName} from './visual-layout-studio';
import {useWindowRecovery} from "./window-recovery";
import {createContext,useContext,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';
import {fitWindow,dragWindow,resizeEditorWindow,validWindowGeometry,WindowGeometry} from '../lib/window-geometry';
import {useModuleVisible} from './module-view';
const PreferenceScope=createContext('');
export const usePreferenceScope=()=>useContext(PreferenceScope);
const Controls=createContext({maximized:false,toggle:()=>{}});
export function WindowLayoutScope({scope,children}:{scope:string;children:ReactNode}){
 useLayoutEffect(()=>{const header=document.querySelector<HTMLElement>('.gp-topbar');if(!header)return;const measure=()=>document.documentElement.style.setProperty('--gp-topbar-height',header.getBoundingClientRect().height+'px');measure();const observer=new ResizeObserver(measure);observer.observe(header);return()=>observer.disconnect()},[]);
 return <PreferenceScope.Provider value={scope}>{children}</PreferenceScope.Provider>;
}
export function useStationaryHeight(variable:string){const ref=useRef<HTMLDivElement>(null);useLayoutEffect(()=>{const el=ref.current,parent=el?.parentElement;if(!el||!parent)return;const measure=()=>parent.style.setProperty(variable,el.getBoundingClientRect().height+'px');measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>{observer.disconnect();parent.style.removeProperty(variable)}},[variable]);return ref}
export function EditorWindowControls(){const c=useContext(Controls);return <button type="button" className="gp-btn" onClick={c.toggle}>{c.maximized?'Restore Size':'Full Size'}</button>}
type Preference={geometry:WindowGeometry;restore?:WindowGeometry;maximized:boolean};
export function FloatingEditorWindow({windowKey,title,children,onClose,closeDisabled=false,existing=false,style}:{windowKey:string;title:string;children:ReactNode;onClose?:()=>void;closeDisabled?:boolean;existing?:boolean;style?:CSSProperties}){
 const scope=useContext(PreferenceScope),visible=useModuleVisible(),key=scope?'groompro:window:v1:'+scope+':'+windowKey:'';
 const root=useRef<HTMLDivElement>(null),preferred=useRef<Preference|null>(null),drag=useRef<{start:WindowGeometry;x:number;y:number;edge:string}|null>(null);
 const[maximized,setMaximized]=useState(false);useVisualRoot(root,visualWindowName(windowKey),visible);
 const bounds=()=>{const r=root.current!.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}};
 function apply(g:WindowGeometry){const el=root.current;if(!el)return;const f=dragWindow({...g,width:Math.min(g.width,document.documentElement.clientWidth-16),height:Math.min(g.height,window.innerHeight-16)},document.documentElement.clientWidth,window.innerHeight);for(const n of ['left','top','width','height'] as const)el.style[n]=f[n]+'px';}
 const full=()=>({left:8,top:8,width:document.documentElement.clientWidth-16,height:window.innerHeight-16});
 function remember(p:Preference){preferred.current=p;if(key)try{localStorage.setItem(key,JSON.stringify(p))}catch{}}
 useLayoutEffect(()=>{let saved:Preference|null=null;if(key)try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&validWindowGeometry(value.geometry)&&(!value.restore||validWindowGeometry(value.restore)))saved=value}catch{}
 const w=Math.min(900,document.documentElement.clientWidth-32),h=Math.min(780,window.innerHeight-32);const initial=saved||{geometry:{left:(document.documentElement.clientWidth-w)/2,top:(window.innerHeight-h)/2,width:w,height:h},maximized:false};preferred.current=initial;setMaximized(initial.maximized===true);apply(initial.maximized?full():initial.geometry);
 const header=root.current?.querySelector<HTMLElement>(':scope > .gp-floating-head');const measure=()=>{if(header)root.current?.style.setProperty('--gp-editor-head-height',header.getBoundingClientRect().height+'px')};measure();const observer=new ResizeObserver(measure);if(header)observer.observe(header);
 const resize=()=>{const p=preferred.current;if(p)apply(p.maximized?full():p.geometry)};window.addEventListener('resize',resize);const viewportObserver=new ResizeObserver(resize);viewportObserver.observe(document.documentElement);return()=>{observer.disconnect();viewportObserver.disconnect();window.removeEventListener('resize',resize)};
 },[key]);
 useWindowRecovery(root,()=>{const g=fitWindow(bounds(),document.documentElement.clientWidth,window.innerHeight);apply(g);remember({...preferred.current!,geometry:g})});
 function toggle(){if(!maximized){const g=bounds();remember({geometry:g,restore:g,maximized:true});apply(full());setMaximized(true)}else{const g=preferred.current?.restore||preferred.current!.geometry;apply(g);remember({geometry:g,maximized:false});setMaximized(false)}}
 function finish(e:React.PointerEvent<HTMLDivElement>){if(drag.current){remember({geometry:bounds(),maximized:false});drag.current=null}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}
 return <Controls.Provider value={{maximized,toggle}}><div ref={root} data-floating-recoverable role="dialog" aria-label={title} className={'gp-floating-window gp-editor-window'+(existing?' gp-editor-existing':'')} style={{...style,...(!visible?{display:'none'}:{})}}
 onPointerDown={e=>{if(maximized)return;const target=e.target as HTMLElement,handle=target.closest<HTMLElement>('[data-editor-resize]'),header=target.closest('.gp-floating-head');if(target.closest('.gp-editor-window')!==e.currentTarget||(!handle&&(!header||target.closest('button,input,select,textarea,a'))))return;e.preventDefault();e.stopPropagation();drag.current={start:bounds(),x:e.clientX,y:e.clientY,edge:handle?.dataset.editorResize||''};e.currentTarget.setPointerCapture(e.pointerId)}}
 onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;apply(d.edge?resizeEditorWindow(d.start,d.edge,dx,dy,document.documentElement.clientWidth,window.innerHeight):{...d.start,left:d.start.left+dx,top:d.start.top+dy})}} onPointerUp={finish} onPointerCancel={finish}>
 {existing?children:<><div className="gp-floating-head"><div className="gp-floating-title">{title}</div><EditorWindowControls/>{onClose&&<button type="button" className="gp-btn" disabled={closeDisabled} onClick={onClose}>Close</button>}</div><div className="gp-editor-content">{children}</div></>}
 {!maximized&&['n','e','s','w','se'].map(edge=><span key={edge} data-editor-resize={edge} className={'gp-editor-resize gp-editor-resize-'+edge} title="Drag to resize" aria-hidden="true">{edge==='se'?'◢':''}</span>)}
 </div></Controls.Provider>;
}
