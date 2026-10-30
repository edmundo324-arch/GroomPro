"use client";
import {useId,useState} from 'react';
import {petVipCode} from '../lib/pet-vip-status';
export const vipBadgeAppearance={
 ASSESS:{symbol:'?',background:'#fff4bf',color:'#594300',border:'#b8860b'},
 DO_NOT_OFFER:{symbol:'⊘',background:'#fde2e2',color:'#8b1e1e',border:'#b91c1c'},
 ELIGIBLE:{symbol:'✓',background:'#dcfce7',color:'#14532d',border:'#15803d'},
 MEMBER:{symbol:'★',background:'#f0e5ff',color:'#581c87',border:'#7e22ce'},
};
export function PetVipBadge({label}:{label:string}){
 const [expanded,setExpanded]=useState(false),id=useId();
 const code=petVipCode(label) as keyof typeof vipBadgeAppearance,appearance=vipBadgeAppearance[code];
 return <span className="gp-hover-vip-status" data-vip-state={code}>
  <button type="button" className="gp-vip-badge" title={label} aria-label={label} aria-expanded={expanded} aria-describedby={expanded?id:undefined} style={{background:appearance.background,color:appearance.color,borderColor:appearance.border}} onClick={event=>{event.stopPropagation();setExpanded(value=>!value)}} onBlur={()=>setExpanded(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setExpanded(false)}}}>
   <span aria-hidden="true">{appearance.symbol}</span><span aria-hidden="true">VIP</span>
  </button>
  <span id={id} role="tooltip" className="gp-vip-badge-explanation" data-open={expanded}>{label}</span>
 </span>;
}
