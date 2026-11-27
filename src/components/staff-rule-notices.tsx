"use client";
import {helpfulError} from '../lib/human-communication';
import {useEffect,useState} from 'react';
import {deviceFetch} from '../lib/offline-device';
import {employeeFetch} from '../lib/employee-fetch';
import {FloatingEditorWindow} from './floating-editor-window';
export function StaffRuleNotices({employeeId}:{employeeId:string}){
 const [notices,setNotices]=useState<any[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{let active=true,pending=false;async function refresh(){if(pending||document.hidden)return;pending=true;try{const r=await deviceFetch('/api/staff-notices',{cache:'no-store'}),d=await r.json();if(active){if(!r.ok){setNotices([]);return}if(d.employeeId===employeeId)setNotices(d.notices||[])}}catch{}finally{pending=false}}void refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}},[employeeId]);
 async function read(id:string){setBusy(id);setError('');try{const r=await employeeFetch('/api/staff-notices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),d=await r.json();if(!r.ok)throw Error(d.error);setNotices(v=>v.filter(n=>n.id!==id))}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <>{!!notices.length&&<button type="button" className="gp-btn" onClick={()=>setOpen(true)}>{notices.length} staff {notices.length===1?'notice':'notices'}</button>}{open&&<FloatingEditorWindow windowKey="staff-rule-notices" title="Your staff notices" onClose={()=>setOpen(false)}><div style={{padding:16,minWidth:0,overflowWrap:'anywhere'}}>{notices.map(n=><article key={n.id} style={{borderBottom:'1px solid #dce5ec',paddingBottom:12,marginBottom:12}}><h3>{n.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{n.body}</p><button type="button" className="gp-btn" disabled={!!busy} onClick={()=>void read(n.id)}>Mark as read</button></article>)}{!notices.length&&<p>You have no unread staff notices.</p>}{error&&<p role="alert">{helpfulError(error)}</p>}</div></FloatingEditorWindow>}</>;
}
