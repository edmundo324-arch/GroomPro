import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {requestLocation} from '@/src/lib/request-location';
import {preparedTestData} from '@/src/lib/import/prepared-test-data';
export const runtime='nodejs';
export async function POST(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value;
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['DEVELOPER','ADMIN'].includes(session.user.role))return NextResponse.json({error:'Administrator access required.'},{status:403});
 try{
  const body=await r.json();if(!['PREVIEW','LOAD'].includes(body.action))throw Error('Choose preview or load.');
  const locationId=await requestLocation(r,tenantId);if(!locationId)throw Error('Select a business location first.');
  const result=await preparedTestData(db,tenantId,locationId,session.user.id,body.action==='LOAD',body.scope==='CUSTOMERS_PETS');
  return NextResponse.json(result);
 }catch(e){console.error('Prepared test-data load failed',e);return NextResponse.json({error:(e as Error).message},{status:400})}
}
