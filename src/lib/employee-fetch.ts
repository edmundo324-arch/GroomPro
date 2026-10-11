"use client";
import {requestMaterial} from './request-fingerprint';
export type PinResult=false|{approval?:string};
export type PinRequest={mode?:'SIGN_IN'|'SWITCH'|'APPROVAL';requestHash?:string;complete:(result:PinResult)=>void};
export function requestEmployeePin(mode:PinRequest['mode']='SIGN_IN',requestHash?:string){return new Promise<PinResult>(complete=>window.dispatchEvent(new CustomEvent<PinRequest>('groompro:request-pin',{detail:{mode,requestHash,complete}})));}
let actionQueue:Promise<unknown>=Promise.resolve();
export function employeeFetch(input:string,init?:RequestInit):Promise<Response>{
 const result=actionQueue.then(()=>authorizedFetch(input,init));
 actionQueue=result.then(()=>undefined,()=>undefined);
 return result;
}
async function authorizedFetch(input:string,init?:RequestInit):Promise<Response>{
 let response=await fetch(input,init);
 for(let attempt=0;attempt<2;attempt++){
  if(![401,403].includes(response.status))return response;
  const body=await response.clone().json().catch(()=>({}));
  const signIn=response.status===401&&/employee (?:PIN is required|session required)/i.test(body.error||'');
  const manager=response.status===403&&/manager|administrator/i.test(body.error||'');
  if(!signIn&&!manager)return response;
  let hash:string|undefined;
  if(manager){
   // Hash the exact body, including multipart boundaries, without submitting it.
   const request=new Request(new URL(input,window.location.origin),init);
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(requestMaterial(request.method,request.url,['GET','HEAD'].includes(request.method)?'':await request.clone().text())));
   hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
   init={...init,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.text()};
  }
  const result=await requestEmployeePin(manager?'APPROVAL':'SIGN_IN',hash);
  if(!result)throw new Error('Action cancelled. Your entered information is preserved.');
  const headers=new Headers(init?.headers);if(result.approval)headers.set('x-groompro-approval',result.approval);
  // Only a rejected authorization is retried. Never retry network/payment failures.
  response=await fetch(input,{...init,headers});
 }
 return response;
}
