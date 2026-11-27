"use client";
import {helpfulError} from '../lib/human-communication';
import {useEffect,useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import {FloatingEditorWindow} from './floating-editor-window';
export function PickupCall({ticketId,locationId,onClose,onSaved}:{ticketId:string;locationId?:string;onClose:()=>void;onSaved:()=>void}){
 const[data,setData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;employeeFetch('/api/tickets/pickup-contact?ticketId='+encodeURIComponent(ticketId)+'&locationId='+encodeURIComponent(locationId||'')).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live)setData(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[ticketId,locationId]);
 async function record(){setBusy(true);setError('');try{const r=await employeeFetch('/api/tickets/visit-history?locationId='+encodeURIComponent(locationId||''),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,calledAt:new Date().toISOString()})}),d=await r.json();if(!r.ok)throw Error(d.error);setNotice('Pickup call recorded.');onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <FloatingEditorWindow initialSize={{width:600,height:420}} windowKey="pickup-call" title="Call Customer" onClose={onClose} style={{zIndex:2100}}><p>{data?.customer||'Customer'} — choose a number to open this device’s calling app. After the call, record it below. If this PC has no calling app, dial the number from your phone.</p>{data?.phones.map((p:any)=><p key={p.id}><a className="gp-btn" href={'tel:'+p.number.replace(/[^+0-9]/g,'')}>Call {p.number}</a></p>)}{data&&!data.phones.length&&<p>No phone number is saved. Add one in Customer Profile → Details.</p>}<button className="gp-btn" disabled={!data?.canRecord||busy||!!notice} onClick={()=>void record()}>Record Call Already Made</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{helpfulError(error)}</p>}</FloatingEditorWindow>;
}
