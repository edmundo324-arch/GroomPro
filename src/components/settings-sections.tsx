"use client";
import {useId,useLayoutEffect,useRef,useState} from 'react';
import {usePreferenceScope} from './floating-editor-window';
import {RetainedSection,useModuleVisible} from './module-view';
import {settingsPlace,settingsPlaceKey,SettingsPlace} from '../lib/settings-place';
type Section={id:string;label:string;content:React.ReactNode};
export function SettingsSections({id,label,sections,initial}:{id:string;label:string;sections:Section[];initial?:string}){
 const scope=usePreferenceScope(),visible=useModuleVisible(),uid=useId(),root=useRef<HTMLDivElement>(null);
 const ids=sections.map(section=>section.id),fallback=initial||ids[0],signature=ids.join('|');
 const [selected,setSelected]=useState(fallback),[ready,setReady]=useState(!scope),[narrow,setNarrow]=useState(false);
 const visited=useRef(new Set<string>()),place=useRef<SettingsPlace>({selected:fallback,panels:{}}),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const key=settingsPlaceKey(scope,id);
 const active=ids.includes(selected)?selected:fallback;
 function persist(){if(!key)return;try{localStorage.setItem(key,JSON.stringify(place.current))}catch{}}
 function remember(panel:HTMLElement,panelId:string){
  const open=Object.fromEntries(Array.from(panel.querySelectorAll('details')).filter(detail=>detail.closest('[data-settings-panel]')===panel).map((detail,index)=>[String(index),detail.open]));
  const nested=Object.fromEntries(Array.from(panel.querySelectorAll<HTMLElement>('[data-settings-scroll]')).filter(element=>element.closest('[data-settings-panel]')===panel).map(element=>[element.dataset.settingsScroll!,{top:element.scrollTop,left:element.scrollLeft}]));
  place.current.panels[panelId]={top:panel.scrollTop,left:panel.scrollLeft,open,...(Object.keys(nested).length?{nested}:{})};
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(persist,150);
 }
 useLayoutEffect(()=>{
  let stored;try{stored=key?JSON.parse(localStorage.getItem(key)||'null'):null}catch{}
  place.current=settingsPlace(stored,ids,fallback);visited.current=new Set([place.current.selected]);setSelected(place.current.selected);setReady(true);
  return()=>{if(timer.current)clearTimeout(timer.current);persist()};
 },[key,signature]);
 useLayoutEffect(()=>{const element=root.current;if(!element)return;const toggled=(event:Event)=>{const target=event.target as HTMLElement;const panel=target.closest<HTMLElement>('[data-settings-panel]');if(panel&&panel.closest('.gp-settings-sections')===element){const panelId=panel.dataset.settingsPanel;if(panelId)remember(panel,panelId)}};element.addEventListener('toggle',toggled,true);element.addEventListener('scroll',toggled,true);return()=>{element.removeEventListener('toggle',toggled,true);element.removeEventListener('scroll',toggled,true)}},[key,signature]);
 useLayoutEffect(()=>{const element=root.current;if(!element)return;const measure=()=>{const width=element.getBoundingClientRect().width;if(width>0)setNarrow(width<=720)};measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect()},[]);
 useLayoutEffect(()=>{
  if(!ready||!visible)return;
  const panel=root.current?.querySelector<HTMLElement>('[data-settings-panel="'+active+'"]');if(!panel)return;
  const saved=place.current.panels[active];if(!saved)return;
  let restoring=true;
  const restore=()=>{if(!restoring)return;Array.from(panel.querySelectorAll('details')).filter(detail=>detail.closest('[data-settings-panel]')===panel).forEach((detail,index)=>{if(Object.hasOwn(saved.open,String(index)))detail.open=saved.open[String(index)]});panel.scrollTop=saved.top;panel.scrollLeft=saved.left;for(const element of Array.from(panel.querySelectorAll<HTMLElement>('[data-settings-scroll]'))){const offset=saved.nested?.[element.dataset.settingsScroll!];if(offset&&element.closest('[data-settings-panel]')===panel){element.scrollTop=offset.top;element.scrollLeft=offset.left;}}};
  restore();const observer=new MutationObserver(restore);observer.observe(panel,{childList:true,subtree:true});
  const stop=()=>{restoring=false;observer.disconnect()};
  for(const event of ['pointerdown','keydown','wheel','touchstart'])panel.addEventListener(event,stop,{capture:true,passive:true});
  return()=>{stop();for(const event of ['pointerdown','keydown','wheel','touchstart'])panel.removeEventListener(event,stop,true)};
 },[active,ready,visible]);
 function choose(next:string){if(!ids.includes(next)||next===active)return;const current=root.current?.querySelector<HTMLElement>('[data-settings-panel="'+active+'"]');if(current)remember(current,active);visited.current.add(next);place.current.selected=next;persist();setSelected(next);}
 return <div ref={root} data-settings-id={id} className={'gp-settings-sections'+(narrow?' is-narrow':'')}>
  <nav className="gp-settings-section-tabs" role="tablist" aria-label={label}>{sections.map((section,index)=><button type="button" role="tab" id={uid+'-tab-'+section.id} aria-controls={uid+'-panel-'+section.id} aria-selected={active===section.id} tabIndex={active===section.id?0:-1} key={section.id} onClick={()=>choose(section.id)} onKeyDown={event=>{const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!offset&&!['Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?sections.length-1:(index+offset+sections.length)%sections.length;choose(sections[next].id);document.getElementById(uid+'-tab-'+sections[next].id)?.focus()}}>{section.label}</button>)}</nav>
  <label className="gp-settings-section-select"><span>{label}</span><select aria-label={label} value={active} onChange={event=>choose(event.target.value)}>{sections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
  <div className="gp-settings-section-panels">{sections.map(section=><div key={section.id} id={uid+'-panel-'+section.id} role="tabpanel" aria-labelledby={uid+'-tab-'+section.id} data-settings-panel={section.id} className="gp-settings-section-panel" hidden={active!==section.id} onScroll={event=>remember(event.currentTarget,section.id)}>
   <RetainedSection active={visible&&active===section.id} visited={ready&&(visited.current.has(section.id)||active===section.id)}>{section.content}</RetainedSection>
  </div>)}</div>
 </div>;
}
