import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readTagCatalog,saveTagCatalog} from '@/src/lib/customer-tags';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});const canManage=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role);try{if(r.method==='GET')return NextResponse.json({...await readTagCatalog(s.tenantId),canManage},{headers:{'Cache-Control':'no-store'}});if(!canManage)return NextResponse.json({error:'Ask an owner or manager to change customer tags and saved filters.'},{status:403});return NextResponse.json(await saveTagCatalog(s.tenantId,s.user.id,await r.json()));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'CUSTOMERS'});
export const PUT=withRequestPolicy(handle,{feature:'CUSTOMERS',configure:true});
