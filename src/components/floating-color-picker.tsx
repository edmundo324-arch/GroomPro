"use client";
import {dragWindow,fitWindow} from "../lib/window-geometry";
import {useWindowRecovery} from "./window-recovery";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function FloatingColorPicker({title,value,onChange,onClose,anchor}:{title:string;value:string;onChange:(v:string)=>void;onClose:()=>void;anchor:DOMRect}){
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const [position,setPosition]=useState(()=>({x:Math.max(8,Math.min(window.innerWidth-292,anchor.right+300<window.innerWidth?anchor.right+12:anchor.left-292)),y:Math.max(8,Math.min(window.innerHeight-370,anchor.right+300<window.innerWidth||anchor.left>=300?anchor.top:anchor.top>=380?anchor.top-380:anchor.bottom+12))})),[hex,setHex]=useState(value);
 useEffect(()=>setHex(value),[value]);
 useEffect(()=>{ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}};const outside=(e:PointerEvent)=>{const target=e.target as HTMLElement;if(!ref.current?.contains(target)&&!target.closest('[data-color-swatch],[data-recover-windows]'))onClose()};document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside)}},[onClose]);
 const move=(x:number,y:number)=>{const g=dragWindow({left:x,top:y,width:ref.current?.offsetWidth||292,height:ref.current?.offsetHeight||370},window.innerWidth,window.innerHeight);setPosition({x:g.left,y:g.top})};
 useWindowRecovery(ref,()=>{const g=fitWindow({left:position.x,top:position.y,width:ref.current?.offsetWidth||292,height:ref.current?.offsetHeight||370},window.innerWidth,window.innerHeight);setPosition({x:g.left,y:g.top})});
 useEffect(()=>{const resize=()=>setPosition(p=>({x:Math.max(8,Math.min(window.innerWidth-292,p.x)),y:Math.max(8,Math.min(window.innerHeight-370,p.y))}));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[]);
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
 return createPortal(<div ref={ref} data-floating-recoverable role="dialog" aria-label={title} tabIndex={-1} className="gp-color-picker" style={{left:position.x,top:position.y}}>
 <div className="gp-color-picker-heading"><div role="button" tabIndex={0} aria-label="Move color picker" onKeyDown={e=>{if(e.key.startsWith('Arrow')){e.preventDefault();move(position.x+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0),position.y+(e.key==='ArrowUp'?-10:e.key==='ArrowDown'?10:0))}}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current)move(drag.current.left+e.clientX-drag.current.x,drag.current.top+e.clientY-drag.current.y)}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>{title}<small>Drag to move</small></div><button type="button" aria-label="Close color picker" onClick={onClose}>×</button></div>
 <div className="gp-color-picker-body"><div className="gp-picked-color" style={{background:value}} aria-label={'Selected color '+value}/><label>Color code<input aria-label="Color code" value={hex} onChange={e=>{setHex(e.target.value);if(/^#[0-9a-f]{6}$/i.test(e.target.value))onChange(e.target.value)}} onBlur={()=>setHex(value)}/></label>
 {['Red','Green','Blue'].map((name,i)=><label key={name}>{name} · {rgb[i]}<input aria-label={name+' color amount'} type="range" min={0} max={255} value={rgb[i]} onChange={e=>onChange('#'+rgb.map((n,j)=>(i===j?+e.target.value:n).toString(16).padStart(2,'0')).join(''))}/></label>)}
 <div className="gp-color-palette">{['#8054b3','#48a548','#102a56','#fff2b2','#228b22','#d9eed3','#ffffff','#000000'].map(c=><button type="button" key={c} aria-label={'Choose '+c} style={{background:c}} onClick={()=>onChange(c)}/>)}</div><button type="button" className="gp-btn" onClick={onClose}>Done</button></div></div>,document.body)
}
