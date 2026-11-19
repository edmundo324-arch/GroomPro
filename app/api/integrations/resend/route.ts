import {NextRequest,NextResponse} from 'next/server';
import {customerEmailConfig} from '@/src/lib/customer-email';
import {validEmailWebhook} from '@/src/lib/email-delivery';
import {recordEmailDelivery} from '@/src/lib/email-delivery-store';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const tenantId=request.nextUrl.searchParams.get('tenantId')||'',config=customerEmailConfig(tenantId);
 if(!config?.webhookSecret)return NextResponse.json({error:'Webhook unavailable.'},{status:404});
 if(Number(request.headers.get('content-length')||0)>131072)return NextResponse.json({error:'Event too large.'},{status:413});
 const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>131072){await reader.cancel();return NextResponse.json({error:'Event too large.'},{status:413});}chunks.push(chunk.value);}
 const raw=Buffer.concat(chunks).toString('utf8');
 if(!validEmailWebhook(raw,request.headers,config.webhookSecret))return NextResponse.json({error:'Invalid signature.'},{status:403});
 let event;try{event=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid event.'},{status:400});}
 try{await recordEmailDelivery(tenantId,config.from,event,request.headers.get('svix-id')!);return NextResponse.json({received:true});}
 catch{return NextResponse.json({error:'Email delivery update could not be recorded.'},{status:503});}
}
