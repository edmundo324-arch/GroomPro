"use client";
import {useEffect,useRef} from 'react';
import {FloatingEditorWindow} from './floating-editor-window';
import {TypeFilters} from './type-filters';
import {matchesCatalogSearch} from '../lib/catalog-search';

export function PosItemSearch({query,onQuery,kinds,onKinds,catalog,disabled,petName,onAdd,onClose}:{query:string;onQuery:(value:string)=>void;kinds:string[];onKinds:(value:string[])=>void;catalog:any;disabled:boolean;petName?:string;onAdd:(item:any)=>void;onClose:()=>void}){
 const input=useRef<HTMLInputElement>(null);
 // Continue the typing that opened this search; this is not automatic form-opening focus.
 useEffect(()=>{const frame=requestAnimationFrame(()=>{input.current?.focus();const end=input.current?.value.length||0;input.current?.setSelectionRange(end,end)});return()=>cancelAnimationFrame(frame)},[]);
 const names:Record<string,string>={services:'Service / Add-on',packages:'Package',products:'Product'};
 const results=kinds.flatMap(kind=>(catalog[kind]||[]).map((item:any)=>({...item,_kind:kind}))).filter((item:any)=>item.active&&matchesCatalogSearch(item,query));
 return <FloatingEditorWindow windowKey="pos-item-search" title="Find Items to Add" onClose={onClose} style={{zIndex:1600}}>
 <section data-module-name="Tickets" style={{color:'var(--gp-text,#172b3a)'}}>
 <p>{petName?'Adding items for '+petName+'.':'Choose an item to add to this ticket.'} Select a row to add it. Prices and descriptions are shown below.</p>
 <label style={{display:'block'}}>Search Items<input ref={input} aria-label="Find Items by Name or Description" placeholder="Type a Name, Description or Code" value={query} onChange={e=>onQuery(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',padding:10,fontSize:'1rem'}}/></label>
 <TypeFilters label="Search Item Types" choices={[{value:'services',label:'Services / Add-ons'},{value:'packages',label:'Packages'},{value:'products',label:'Products'}]} selected={kinds} onChange={onKinds}/>
 <p role="status">{results.length} Matching {results.length===1?'Item':'Items'}</p>
 <div style={{border:'1px solid #d6e0e9',borderRadius:8,overflow:'hidden',background:'#fff'}}>{results.map((item:any)=><button key={item._kind+':'+item.id} type="button" disabled={disabled} onClick={()=>onAdd(item)} aria-label={'Add '+item.name} style={{display:'block',width:'100%',textAlign:'left',padding:'16px 18px',border:0,borderBottom:'1px solid #d6e0e9',background:'transparent',color:'#172b3a',fontSize:'1rem',whiteSpace:'normal',cursor:disabled?'default':'pointer'}}>
 <span style={{display:'flex',justifyContent:'space-between',gap:16}}><strong>{item.name}</strong><strong style={{whiteSpace:'nowrap'}}>${((item.priceCents||0)/100).toFixed(2)}</strong></span>
 <span style={{display:'block',color:'#576b7d',marginTop:5}}>{names[item._kind]}{item.durationMin!=null?' · '+item.durationMin+' min':''}{item.category?' · '+item.category:''}</span>
 {item.description&&<span style={{display:'block',lineHeight:1.45,marginTop:6}}>{item.description}</span>}
 </button>)}{!results.length&&<p style={{padding:18}}>No matching items. Try another name or description, or choose All.</p>}</div>
 </section></FloatingEditorWindow>;
}
