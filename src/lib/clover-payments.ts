import { randomUUID } from "node:crypto";

export type CloverChargeResult={ok:boolean;chargeId?:string;message?:string;raw?:unknown};

export async function chargeCloverToken(params:{source:string;amountCents:number;description:string;externalReference:string;receiptEmail?:string|null}) : Promise<CloverChargeResult> {
  const token=process.env.CLOVER_ACCESS_TOKEN;
  if(!token) return {ok:false,message:"Clover payment processing is not connected for this business."};
  const base=process.env.CLOVER_API_BASE_URL||"https://scl-sandbox.dev.clover.com";
  const response=await fetch(`${base}/v1/charges`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",Authorization:`Bearer ${token}`,"idempotency-key":randomUUID()},body:JSON.stringify({amount:params.amountCents,currency:"usd",source:params.source,description:params.description,external_reference_id:params.externalReference,receipt_email:params.receiptEmail||undefined,ecomind:"ecom",stored_credentials:{sequence:"SUBSEQUENT",is_scheduled:false,initiator:"MERCHANT"}})});
  const raw=await response.json().catch(()=>null);
  if(!response.ok)return {ok:false,message:raw?.message||raw?.error?.message||"Clover declined or could not process the card-on-file charge.",raw};
  return {ok:true,chargeId:raw?.id,raw};
}
