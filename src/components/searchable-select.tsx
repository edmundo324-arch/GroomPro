"use client";
import {Children,isValidElement,useId,useState,useRef,useLayoutEffect,type ReactNode,type SelectHTMLAttributes,type ChangeEvent,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
type Option={value:string;label:string;description:string;disabled:boolean};
function text(node:ReactNode):string{return Children.toArray(node).map(n=>isValidElement(n)?text((n.props as any).children):String(n)).join('');}
function options(children:ReactNode):Option[]{return Children.toArray(children).flatMap(n=>{if(!isValidElement(n))return [];const p=n.props as any;return n.type==='option'?[{value:String(p.value??text(p.children)),label:text(p.children),description:p['data-description']||'',disabled:!!p.disabled}]:options(p.children);});}
/** Catalog and record picker: typing filters choices; only an intentional choice changes the saved value. */
export function SearchableSelect({children,value,onChange,disabled,multiple,defaultOpen=false,floating=false,'aria-label':label,'data-help':help,...props}:SelectHTMLAttributes<HTMLSelectElement>&{'data-help'?:string;defaultOpen?:boolean;floating?:boolean}){
 const id=useId(),[query,setQuery]=useState(''),[open,setOpen]=useState(defaultOpen),[active,setActive]=useState(-1);
 const root=useRef<HTMLSpanElement>(null),input=useRef<HTMLInputElement>(null),list=useRef<HTMLSpanElement>(null),[placement,setPlacement]=useState<CSSProperties|null>(null);
 useLayoutEffect(()=>{
  if(!floating||!open)return;
  const position=()=>{const field=input.current;if(!field)return;const r=field.getBoundingClientRect(),width=Math.min(Math.max(r.width,240),window.innerWidth-16),below=window.innerHeight-r.bottom-8,above=r.top-8,up=below<160&&above>below,height=Math.min(240,Math.max(48,up?above:below)),style=getComputedStyle(field);setPlacement({position:'fixed',left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),...(up?{bottom:window.innerHeight-r.top+2}:{top:r.bottom+2}),width,maxHeight:height,zIndex:10000,font:style.font,background:style.getPropertyValue('--gp-surface')||'#fff',color:style.getPropertyValue('--gp-text')||'#172b3a',boxSizing:'border-box',boxShadow:'0 5px 18px #0003'})};
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!list.current?.contains(e.target as Node)){setOpen(false);setQuery('');setActive(-1)}};
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);document.addEventListener('pointerdown',outside,true);
  const observer=new ResizeObserver(position);if(input.current)observer.observe(input.current);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside,true);observer.disconnect()};
 },[floating,open]);
 const rows=options(children),values=Array.isArray(value)?value.map(String):[String(value??'')];
 const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const found=rows.filter(o=>terms.every(t=>(o.label+' '+o.description).toLocaleLowerCase().includes(t))),visible=found.slice(0,50);
 const display=rows.filter(o=>values.includes(o.value)).map(o=>o.label).join(', ');
 function choose(o:Option){if(o.disabled||disabled)return;const next=multiple?(values.includes(o.value)?values.filter(v=>v!==o.value):[...values,o.value]):[o.value];const target={value:next[0]||'',selectedOptions:next.map(value=>({value}))};onChange?.({target,currentTarget:target} as unknown as ChangeEvent<HTMLSelectElement>);setQuery('');setActive(-1);if(!multiple)setOpen(false);}
 const choices=<span ref={list} id={id} role="listbox" aria-label={label||'Matching Choices'} aria-multiselectable={multiple||undefined} style={{display:'block',maxHeight:240,overflowY:'auto',border:'1px solid #a9bac9',background:'var(--gp-surface,#fff)',color:'var(--gp-text,#172b3a)',...(floating?placement:{})}}>
   {visible.map((o,i)=><button type="button" role="option" tabIndex={floating?-1:undefined} aria-selected={values.includes(o.value)} id={`${id}-${i}`} key={o.value} disabled={o.disabled||disabled} onPointerDown={floating?e=>e.preventDefault():undefined} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)} style={{display:'block',textAlign:'left',width:'100%',padding:9,border:0,borderBottom:'1px solid #dce4eb',background:i===active?'#e5eff7':'transparent',color:'inherit'}}><strong>{multiple&&values.includes(o.value)?'✓ ':''}{o.label}</strong>{o.description&&<small style={{display:'block',fontWeight:400,whiteSpace:'normal'}}>{o.description}</small>}</button>)}
   {!found.length&&<span role="status" style={{display:'block',padding:9}}>No Matching Choices. Try a Different Name or Description.</span>}
   {found.length>50&&<span style={{display:'block',padding:9}}>Showing 50 Matches. Type More to Narrow the List.</span>}
  </span>;
 return <span ref={root} style={{display:'block',minWidth:0,maxWidth:'100%'}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)&&!list.current?.contains(e.relatedTarget as Node)){setOpen(false);setQuery('');setActive(-1)}}}>
  <input ref={input} {...Object.fromEntries(Object.entries(props).filter(([key])=>key.startsWith('data-')))} required={props.required} name={props.name} aria-describedby={props['aria-describedby']} id={props.id} className={props.className} style={{width:'100%',boxSizing:'border-box',...props.style}} role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={active>=0?`${id}-${active}`:undefined} data-help={help} autoComplete="off" disabled={disabled} value={open?query:display} placeholder="Type a Name or Description" onFocus={()=>{setOpen(true);setQuery('')}} onClick={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setActive(-1);setOpen(true)}} onKeyDown={e=>{
   if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);setQuery('');setActive(-1)}
   else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(v=>Math.max(0,Math.min(visible.length-1,v+(e.key==='ArrowDown'?1:-1))))}
   else if(e.key==='Enter'&&open){e.preventDefault();if(active>=0&&visible[active])choose(visible[active]);else if(visible.length===1)choose(visible[0])}
  }}/>
  {open&&(floating?(placement&&typeof document!=='undefined'?createPortal(choices,document.body):null):choices)}
 </span>;
}
