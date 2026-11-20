import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {onlineClassCatalog,changeOnlineCatalog,readOnlineClasses,saveOnlineClasses} from '@/src/lib/online-booking-classes';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role))return NextResponse.json({error:'Ask an owner or manager to change online-booking classes.'},{status:403});try{return NextResponse.json(r.method==='GET'?(r.nextUrl.searchParams.has('id')?await readOnlineClasses(s.tenantId,String(r.nextUrl.searchParams.get('kind')),String(r.nextUrl.searchParams.get('id'))):{classes:await onlineClassCatalog(s.tenantId)}):r.method==='POST'?await changeOnlineCatalog(s.tenantId,s.user.id,await r.json()):await saveOnlineClasses(s.tenantId,s.user.id,await r.json()),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});

export const POST=withRequestPolicy(handle,{configure:true});
