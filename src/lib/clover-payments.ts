import { randomUUID } from "node:crypto";
import {isTestSite} from './site-deployment';

export type CloverChargeResult={ok:boolean;chargeId?:string;message?:string;raw?:unknown};

export async function chargeCloverToken(params:{idempotencyKey?:string;source:string;amountCents:number;description:string;externalReference:string;receiptEmail?:string|null}) : Promise<CloverChargeResult> {
  if(isTestSite())return {ok:false,message:'Card charges are disabled in this separate testing workspace.'};
  const token=process.env.CLOVER_ACCESS_TOKEN;
  if(!token) return {ok:false,message:"Clover payment processing is not connected for this business."};
  const base=process.env.CLOVER_API_BASE_URL||"https://scl-sandbox.dev.clover.com";
  const response=await fetch(`${base}/v1/charges`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",Authorization:`Bearer ${token}`,"idempotency-key":params.idempotencyKey||randomUUID()},body:JSON.stringify({amount:params.amountCents,currency:"usd",source:params.source,description:params.description,external_reference_id:params.externalReference,receipt_email:params.receiptEmail||undefined,ecomind:"ecom",stored_credentials:{sequence:"SUBSEQUENT",is_scheduled:false,initiator:"MERCHANT"}})});
  const raw=await response.json().catch(()=>null);
  if(response.status>=500||response.status===408||response.ok&&!raw?.id)throw Error("The card charge could not be verified. Review payment history before trying again; reserved Customer Credit is held until this charge is resolved.");
  if(!response.ok)return {ok:false,message:raw?.message||raw?.error?.message||"Clover declined or could not process the card-on-file charge.",raw};
  return {ok:true,chargeId:raw?.id,raw};
}
