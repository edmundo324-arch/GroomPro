import {sendCustomerEmail} from '@/src/lib/customer-email';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {moduleDenial} from '@/src/lib/module-entitlement';
import {writeAudit} from '@/src/lib/audit';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {sendCustomerSms,TextingPlanError} from '@/src/lib/sms';
import {customerContactFeature,isFeatureEnabled} from '@/src/lib/feature-access';
import {normalizePhone} from '@/src/lib/customer';
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/src/lib/db";
async function tenant(r:NextRequest){const explicit=r.headers.get("x-tenant-id")||r.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||null;return explicit}
async function handlePolicyGET(r:NextRequest){const denial=await moduleDenial(r,'MESSAGING');if(denial)return denial;const t=await tenant(r);if(!t)return NextResponse.json({error:"Business setup is not complete yet."},{status:503});const rows=await db.communication.findMany({where:{tenantId:t},include:{customer:{select:{firstName:true,lastName:true}}},orderBy:{createdAt:"desc"},take:100});return NextResponse.json({communications:rows,textingEnabled:await isFeatureEnabled(t,customerContactFeature)})}
async function handlePolicyPOST(r:NextRequest){const denial=await moduleDenial(r,'MESSAGING');if(denial)return denial;const t=await tenant(r);if(!t)return NextResponse.json({error:'Business context required.'},{status:401});const sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(t,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});try{const b=await r.json();if(b.channel==='EMAIL'){const result=await sendCustomerEmail({tenantId:t,customerId:String(b.customerId||''),body:String(b.body||'')});await writeAudit({tenantId:t,actorUserId:session.user.id,entityType:'COMMUNICATION',entityId:result.communication.id,customerId:result.communication.customerId||undefined,action:'EMAIL_'+result.communication.deliveryStatus,summary:result.message});return NextResponse.json(result,{status:201})}if(b.channel&&b.channel!=='SMS')throw Error('Choose SMS or email.');let phoneId=b.phoneId;if(b.toAddress){const phone=await db.customerPhone.findFirst({where:{tenantId:t,customerId:String(b.customerId),normalized:normalizePhone(String(b.toAddress)),smsEnabled:true}});if(!phone)throw Error('Choose a phone number from this customer’s profile that has texting enabled.');phoneId=phone.id}const result=await sendCustomerSms({tenantId:t,customerId:String(b.customerId||''),phoneId,body:String(b.body||'')});await writeAudit({tenantId:t,actorUserId:session.user.id,entityType:"COMMUNICATION",entityId:result.communication.id,customerId:String(b.customerId),action:"MESSAGE",summary:result.message});return NextResponse.json(result,{status:201})}catch(e){return NextResponse.json({error:e instanceof TextingPlanError?e.message:String(e)},{status:e instanceof TextingPlanError?403:400})}}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'MESSAGING'});
export const POST=withRequestPolicy(handlePolicyPOST, {feature:'MESSAGING'});
