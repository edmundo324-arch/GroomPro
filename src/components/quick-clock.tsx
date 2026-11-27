'use client';
import {useRef,useState} from 'react';
import {helpfulError} from '../lib/human-communication';
import {createPortal} from 'react-dom';
import {FloatingEditorWindow} from './floating-editor-window';

export function QuickClock({locationId,onClose}:{locationId?:string;onClose:()=>void}){
 const [pin,setPin]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [shops,setShops]=useState<{id:string;name:string}[]>([]),[shop,setShop]=useState(locationId||'');
 const pending=useRef(false);
 async function punch(action:'IN'|'OUT'){
  if(pending.current)return;
  if(!/^\d{3,10}$/.test(pin)){setMessage('Enter your 3–10 digit employee PIN.');return;}
  pending.current=true;setBusy(true);setMessage('');
  try{
   const path='/api/employee/session'+(shop?'?locationId='+encodeURIComponent(shop):'');
   const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'QUICK_CLOCK',action,pin})});
   const result=await response.json();
   if(Array.isArray(result.locations))setShops(result.locations);
   if(!response.ok||!result.at)throw Error(result.error||'Check your time record before trying again.');
   window.dispatchEvent(new Event('groompro:time-clock-changed'));
   setMessage(result.name+' clocked '+(action==='IN'?'in':'out')+' at '+new Date(result.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'.');
  }catch(error){setMessage(error instanceof Error && !(error instanceof SyntaxError)?error.message:'Check the connection and your time record before trying again.');}
  finally{setPin('');setBusy(false);pending.current=false;}
 }
 return createPortal(<FloatingEditorWindow windowKey="quick-clock" title="Quick Clock In/Out" initialSize={{width:390,height:235}} onClose={onClose} closeDisabled={busy}>
  <div style={{padding:16,color:'var(--text, #172d40)'}}>
   {shops.length>0&&<label>Shop Location <select value={shop} onChange={e=>setShop(e.target.value)}><option value="">Choose Location</option>{shops.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
   <label>Employee PIN <input type="password" inputMode="numeric" autoComplete="off" maxLength={10} value={pin} disabled={busy} onChange={e=>{setPin(e.target.value);setMessage('')}}/></label>
   <p><button type="button" disabled={busy} onClick={()=>punch('IN')}>Clock In</button> <button type="button" disabled={busy} onClick={()=>punch('OUT')}>Clock Out</button></p>
   <div role="status">{helpfulError(message)}</div>
  </div>
 </FloatingEditorWindow>,document.body);
}
