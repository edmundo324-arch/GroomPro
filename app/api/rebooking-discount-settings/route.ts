import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readRebookingDiscountPolicy,saveRebookingDiscountPolicy} from '@/src/lib/rebooking-discount-policy';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role))return NextResponse.json({error:'Ask an owner or manager to change rebooking discount deadlines.'},{status:403});try{return NextResponse.json(r.method==='GET'?await readRebookingDiscountPolicy(s.tenantId):await saveRebookingDiscountPolicy(s.tenantId,s.user.id,await r.json()),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
