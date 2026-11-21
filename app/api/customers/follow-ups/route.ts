import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {customerFollowUps,stopCustomerFollowUp} from '@/src/lib/customer-follow-ups';
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 try{const input=r.method==='GET'?{customerId:r.nextUrl.searchParams.get('customerId')}:await r.json();
  if(typeof input.customerId!=='string'||!input.customerId||input.customerId.length>191)throw Error('Open a saved customer profile to review its follow-ups.');
  const data=r.method==='GET'?await customerFollowUps(db,session.tenantId,input.customerId):await stopCustomerFollowUp(db,session.tenantId,session.user.id,input);
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'CUSTOMERS'});
export const PATCH=withRequestPolicy(handle,{feature:'CUSTOMERS'});
