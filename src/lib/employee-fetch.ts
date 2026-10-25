"use client";
import {requestMaterial} from './request-fingerprint';
export type PinResult=false|{approval?:string};
export type PinRequest={mode?:'SIGN_IN'|'SWITCH'|'APPROVAL';requestHash?:string;complete:(result:PinResult)=>void};
export function requestEmployeePin(mode:PinRequest['mode']='SIGN_IN',requestHash?:string){return new Promise<PinResult>(complete=>window.dispatchEvent(new CustomEvent<PinRequest>('groompro:request-pin',{detail:{mode,requestHash,complete}})));}
// Serialize conflicting records, not the entire application. Unknown operations
// share a conservative fallback until their record identity is available.
const mutations=new Map<string,Promise<unknown>>();
export function mutationKeys(input:string,init?:RequestInit):string[]{
 const url=new URL(input,'http://groompro.local'),path=url.pathname;let body:any={};
 try{if(typeof init?.body==='string')body=JSON.parse(init.body)}catch{}
 const keys=new Set<string>();
 const add=(type:string,id:unknown)=>{if(typeof id==='string'&&id)keys.add(`${type}:${id}`)};
 add('ticket',body.ticketId||url.searchParams.get('ticketId'));
 add('draft',body.draftId||body.draft?.draftId);
 add('customer',body.customerId);add('pet',body.petId);
 if(/^\/api\/customers\/[^/]+$/.test(path)&&!['account','rewards','payment-methods','location-access'].includes(path.split('/')[3]))add('customer',path.split('/')[3]);
 if(path==='/api/pets')add('pet',body.id);
 if(path==='/api/pos-drafts')add('draft',body.id||body.requestKey);
 if(path==='/api/grooming-notes'){add('note',body.id);if(body.permanent)add(body.permanent==='CUSTOMER'?'customer':'pet',body.entityId)}
 if(path==='/api/catalog')add(body.kind||'catalog',body.id);
 if(path==='/api/products')add('products',body.id);
 if(path==='/api/employees'||path==='/api/employees/compensation')add('employee',body.id||body.userId);
 if(path==='/api/ticket-lines')add('line',body.lineId||url.searchParams.get('lineId'));
 if(path==='/api/tickets')add('ticket',body.id);
 if(!keys.size)keys.add('unidentified:'+path);
 return [...keys];
}
let signIn:Promise<PinResult>|null=null;
let authorizationQueue:Promise<unknown>=Promise.resolve();
function authorize(mode:PinRequest['mode'],hash?:string){if(mode==='SIGN_IN'&&signIn)return signIn;const result=authorizationQueue.then(()=>requestEmployeePin(mode,hash));authorizationQueue=result.catch(()=>false);if(mode==='SIGN_IN'){signIn=result;void result.finally(()=>{if(signIn===result)signIn=null}).catch(()=>{})}return result;}
let contextEpoch=0;
export function clearEmployeeReads(){contextEpoch++;reads.clear()}
const reads=new Map<string,Promise<Response>>();
export function employeeFetch(input:string,init?:RequestInit):Promise<Response>{
 if(['GET','HEAD'].includes((init?.method||'GET').toUpperCase())){
  // Share only simultaneous identical reads; retain no response cache across sessions.
  if(init?.signal||init?.headers)return authorizedFetch(input,init);
  let pending=reads.get(input);if(!pending){pending=authorizedFetch(input,init);reads.set(input,pending);void pending.finally(()=>{if(reads.get(input)===pending)reads.delete(input)}).catch(()=>{})}
  return pending.then(r=>r.clone());
 }
 const epoch=contextEpoch,keys=mutationKeys(input,init);
 const prior=[...new Set(keys.map(k=>mutations.get(k)).filter(Boolean))];
 const run=()=>{if(epoch!==contextEpoch)throw Error('Business or employee changed. Reopen this record before saving.');return authorizedFetch(input,init)};
 const result=prior.length?Promise.all(prior).then(run):Promise.resolve().then(run);
 const settled=result.then(response=>{if(response.ok&&epoch===contextEpoch)window.dispatchEvent(new CustomEvent('groompro:data-changed',{detail:{url:input}}));},()=>undefined);
 keys.forEach(k=>mutations.set(k,settled));
 void settled.then(()=>keys.forEach(k=>{if(mutations.get(k)===settled)mutations.delete(k)}));
 return result;
}
async function authorizedFetch(input:string,init?:RequestInit):Promise<Response>{
 const epoch=contextEpoch;const approved:string[]=[];
 for(let attempt=0;attempt<12;attempt++){
  const response=await pinAuthorizedFetch(input,init);
  if(response.ok)return response;
  const body=await response.clone().json().catch(()=>({}));
  if(!body.schedulingWarning||typeof init?.body!=='string'||approved.includes(body.schedulingWarning))return response;
  const accepted=await new Promise<boolean>(complete=>window.dispatchEvent(new CustomEvent('groompro:scheduling-warning',{detail:{message:body.error,complete}})));
  if(!accepted)return new Response(JSON.stringify({error:'Action cancelled.'}),{status:409,headers:{'Content-Type':'application/json'}});
  if(epoch!==contextEpoch)throw Error('Business or employee changed. Reopen this record before saving.');
  if(body.savedTicketId&&input==='/api/pos-operation'){const payload=JSON.parse(init.body as string);init={...init,body:JSON.stringify({...payload,ticketId:body.savedTicketId})};}
  approved.push(body.schedulingWarning);const headers=new Headers(init?.headers);headers.set('x-groompro-scheduling-overrides',encodeURIComponent(JSON.stringify(approved)));init={...init,headers};
 }
 throw Error('Scheduling conditions changed. Review this appointment before trying again.');
}
async function pinAuthorizedFetch(input:string,init?:RequestInit):Promise<Response>{
 let response=await fetch(input,init);
 for(let attempt=0;attempt<2;attempt++){
  if(![401,403].includes(response.status))return response;
  const body=await response.clone().json().catch(()=>({}));
  const signIn=response.status===401&&/employee (?:PIN is required|session required)/i.test(body.error||'');
  let manager=response.status===403&&/manager|administrator/i.test(body.error||'');
  if(!signIn&&!manager)return response;
  if(manager){const current=await fetch('/api/employee/session').then(r=>r.json());if(!current.employee)manager=false;}
  let hash:string|undefined;
  if(manager){
   // Hash the exact body, including multipart boundaries, without submitting it.
   const request=new Request(new URL(input,window.location.origin),init);
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(requestMaterial(request.method,request.url,['GET','HEAD'].includes(request.method)?'':await request.clone().text())));
   hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
   init={...init,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.text()};
  }
  const result=await authorize(manager?'APPROVAL':'SIGN_IN',hash);
  if(!result)throw new Error('Action cancelled. Your entered information is preserved.');
  const headers=new Headers(init?.headers);if(result.approval)headers.set('x-groompro-approval',result.approval);
  // Only a rejected authorization is retried. Never retry network/payment failures.
  response=await fetch(input,{...init,headers});
 }
 return response;
}
