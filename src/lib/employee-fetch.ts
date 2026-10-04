"use client";
export type PinRequest={complete:(signedIn:boolean)=>void};
// Only authentication rejections are retried; never retry a timeout or payment failure.
let actionQueue:Promise<unknown>=Promise.resolve();
export function employeeFetch(input:string,init?:RequestInit):Promise<Response>{
 if(!init?.method||['GET','HEAD','OPTIONS'].includes(init.method.toUpperCase()))return fetch(input,init);
 // Do not let several pending actions consume the same one-action PIN session.
 const result=actionQueue.then(()=>authorizedFetch(input,init));
 actionQueue=result.then(()=>undefined,()=>undefined);
 return result;
}
async function authorizedFetch(input:string,init?:RequestInit):Promise<Response>{
 const response=await fetch(input,init);
 if(response.status!==401||!init?.method||init.method.toUpperCase()==="GET")return response;
 const body=await response.clone().json().catch(()=>({}));
 if(!/employee (?:PIN is required|session required)/i.test(body.error||""))return response;
 const signedIn=await new Promise<boolean>(complete=>window.dispatchEvent(new CustomEvent<PinRequest>("groompro:request-pin",{detail:{complete}})));
 if(!signedIn)throw new Error("Action cancelled. Your changes have not been submitted.");
 return fetch(input,init);
}

