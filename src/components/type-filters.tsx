"use client";
export function TypeFilters({label,choices,selected,onChange}:{label:string;choices:{value:string;label:string}[];selected:string[];onChange:(selected:string[])=>void}){
 const all=choices.every(c=>selected.includes(c.value));
 return <span role="group" aria-label={label} style={{display:'inline-flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
  <label style={{display:"inline-flex",alignItems:"center",gap:4,margin:0}}><input style={{width:16,minWidth:16,maxWidth:16,minHeight:16,padding:0,flex:"0 0 16px"}} type="checkbox" checked={all} onChange={e=>onChange(e.target.checked?choices.map(c=>c.value):[])}/> All</label>
  {choices.map(c=><label key={c.value} style={{display:"inline-flex",alignItems:"center",gap:4,margin:0}}><input style={{width:16,minWidth:16,maxWidth:16,minHeight:16,padding:0,flex:"0 0 16px"}} type="checkbox" checked={selected.includes(c.value)} onChange={e=>onChange(e.target.checked?[...selected,c.value]:selected.filter(v=>v!==c.value))}/> {c.label}</label>)}
 </span>;
}
