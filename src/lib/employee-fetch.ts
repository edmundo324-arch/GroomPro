"use client";
export type PinRequest={complete:(signedIn:boolean)=>void};
// Only authentication rejections are retried; never retry a timeout or payment failure.
export async function employeeFetch(input:string,init?:RequestInit):Promise<Response>{
 const response=await fetch(input,init);
 if(response.status!==401||!init?.method||init.method.toUpperCase()==="GET")return response;
 const body=await response.clone().json().catch(()=>({}));
 if(!/employee PIN is required/i.test(body.error||""))return response;
 const signedIn=await new Promise<boolean>(complete=>window.dispatchEvent(new CustomEvent<PinRequest>("groompro:request-pin",{detail:{complete}})));
 if(!signedIn)throw new Error("Action cancelled. Your changes have not been submitted.");
 return fetch(input,init);
}

