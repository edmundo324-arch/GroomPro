import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readPromotions,savePromotions,applyPromotions} from '@/src/lib/promotion-store';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});const manager=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role);if(r.method!=='POST'&&!manager)return NextResponse.json({error:'Ask an owner or manager to configure promotions.'},{status:403});try{const body=r.method==='GET'?null:await r.json();return NextResponse.json(r.method==='GET'?await readPromotions(s.tenantId):r.method==='PUT'?await savePromotions(s.tenantId,s.user.id,body):await applyPromotions(s.tenantId,s.user.id,String(body.ticketId||''),String(body.code||''),body.action==='PERCENT'?{percent:body.percent,lineIds:body.lineIds}:undefined),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
export const POST=withRequestPolicy(handle,{});
