import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {managerAction} from '@/src/lib/protected-action';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||'';
const allowed=['name','email','phones','contacts','pets','balance','upcoming','sourceId'];
async function handlePolicyGET(r:NextRequest){const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context required.'},{status:401});const entry=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_DISPLAY'}}});return NextResponse.json({fields:entry?.value||['name','email','phones','pets']});}
const handlePolicyPUT=managerAction(async(r:NextRequest)=>{const tenantId=tenant(r),b=await r.json();if(!Array.isArray(b.fields)||b.fields.some((f:any)=>!allowed.includes(f))||new Set(b.fields).size!==b.fields.length)return NextResponse.json({error:'Choose valid display fields.'},{status:400});const key={tenantId,settingKey:'CUSTOMER_DISPLAY'};await db.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value:b.fields},update:{value:b.fields}});return NextResponse.json({fields:b.fields});});

export const GET=withRequestPolicy(handlePolicyGET, {});
export const PUT=withRequestPolicy(handlePolicyPUT, {});
