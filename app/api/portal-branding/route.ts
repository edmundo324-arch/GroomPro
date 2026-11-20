import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readPortalBranding,savePortalBranding} from '@/src/lib/portal-branding';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Ask an owner or manager to change the customer portal appearance.'},{status:403});try{if(r.method==='GET')return NextResponse.json(await readPortalBranding(session.tenantId),{headers:{'Cache-Control':'no-store'}});const raw=await r.text();if(raw.length>1_500_000)throw Error('Choose a business logo no larger than 1 MB.');return NextResponse.json(await savePortalBranding(session.tenantId,session.user.id,JSON.parse(raw)));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
