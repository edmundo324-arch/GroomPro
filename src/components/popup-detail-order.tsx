"use client";
import {useRef} from 'react';
import {additionalPopupFields,movePopupField} from '../lib/calendar-popup-layout';
import {friendlyHoverLabel} from '../lib/calendar-hover-details';
export function PopupDetailOrder({fields,onChange}:{fields:string[];onChange:(fields:string[])=>void}){
 const dragging=useRef('');
 const sections=[['ticket','Ticket details'],['customer','Customer details'],['pet','Additional pet details'],['service','Service-line details']];
 return <div className="gp-popup-detail-order"><h4>Order of additional details</h4><small>Drag selected details or use the arrows. The main pet information stays in its fixed order.</small>
 {sections.map(([section,title])=>{const selected=additionalPopupFields(fields,section);return selected.length?<section key={section}><strong>{title}</strong><ol aria-label={title+' order'}>{selected.map((key,index)=><li key={key} draggable onDragStart={event=>{dragging.current=key;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',key)}} onDragEnd={()=>{dragging.current=''}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(dragging.current)onChange(movePopupField(fields,dragging.current,key));dragging.current=''}}>
 <span className="gp-popup-order-grip" aria-hidden="true">↕</span><span>{friendlyHoverLabel(key)}</span>
 <button type="button" className="gp-btn" aria-label={'Move '+friendlyHoverLabel(key)+' earlier in '+title} disabled={index===0} onClick={()=>onChange(movePopupField(fields,key,selected[index-1]))}>↑</button>
 <button type="button" className="gp-btn" aria-label={'Move '+friendlyHoverLabel(key)+' later in '+title} disabled={index===selected.length-1} onClick={()=>onChange(movePopupField(fields,key,selected[index+1]))}>↓</button>
 </li>)}</ol></section>:null})}</div>;
}
