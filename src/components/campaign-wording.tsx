'use client';
import {useRef} from 'react';
import {templateDetailLabels} from '../lib/reminder-templates';

const labels:Record<string,string>={...templateDetailLabels,portalLink:'Customer Portal Link',reviewLink:'Review Link',notice:'Cancellation Notice',fee:'Cancellation Fee',pet:'Dog Name',vaccine:'Vaccine',expirationDate:'Expiration Date',package:'Package Name',visits:'Remaining Visits',expiration:'Expiration',customerName:'Customer Full Name',petName:'Dog Names',businessName:'Business Name',membershipName:'Membership',balanceDue:'Balance Due',taskTitle:'Task',dueDate:'Due Date'};
export function CampaignWording({label,value,onChange,fields,multiLocation=false,maxLength=1200}:{label:string;value:string;onChange:(text:string)=>void;fields:readonly string[];multiLocation?:boolean;maxLength?:number}){
 const input=useRef<HTMLTextAreaElement>(null);
 function insert(key:string){
  const area=input.current;if(!area)return;
  const token='{'+key+'}',start=area.selectionStart,end=area.selectionEnd;
  const next=value.slice(0,start)+token+value.slice(end);
  if(next.length>maxLength)return;
  onChange(next);
  requestAnimationFrame(()=>{area.focus();area.setSelectionRange(start+token.length,start+token.length)});
 }
 return <div style={{maxWidth:850,marginBlock:10}}><label style={{display:'grid'}}>{label}<textarea ref={input} rows={3} maxLength={maxLength} value={value} onChange={e=>onChange(e.target.value)}/></label><div aria-label={'Insert details into '+label} style={{display:'flex',gap:4,flexWrap:'wrap'}}>{fields.filter(key=>key!=='location'||multiLocation).map(key=><button type="button" className="gp-btn" key={key} onClick={()=>insert(key)}>{key==='location'?'Location':labels[key]||key}</button>)}</div></div>;
}
