import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {recordCustomerDeposit} from '@/src/lib/customer-deposits';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{const input=await r.json(),locationId=await requestLocation(r,session.tenantId);if(!locationId)throw Error('Choose the shop receiving this deposit.');return NextResponse.json(await recordCustomerDeposit(session.tenantId,session.user.id,String(input.customerId||''),locationId,input),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
