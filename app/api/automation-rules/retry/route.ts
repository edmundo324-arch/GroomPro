import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestRuleRetry} from '@/src/lib/custom-rule-retry';
export const POST=withRequestPolicy(async(r:NextRequest)=>{
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'An owner or manager must sign in to retry automatic rules.'},{status:403});
 try{const body=await r.json();if(typeof body.communicationId!=='string'||!body.communicationId||body.communicationId.length>191)throw Error('Choose a failed message from Recent rule activity.');return NextResponse.json(await requestRuleRetry(db,session.tenantId,session.user.id,body.communicationId),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
},{configure:true});
