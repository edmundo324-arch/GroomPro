import {NextRequest,NextResponse} from 'next/server';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getAgreementPhoto} from '@/src/lib/customer-agreement-store';

async function photo(r:NextRequest){
 const tenant=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value,pet=r.nextUrl.searchParams.get('pet');
 if(!sid||!pet||tenant!==r.nextUrl.searchParams.get('tenant')||!await getActiveEmployeeSession(tenant,sid))return new NextResponse(null,{status:404});
 const bytes=await getAgreementPhoto(tenant,pet);
 return bytes?new NextResponse(new Uint8Array(bytes),{headers:{'Cache-Control':'no-store','Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'}}):new NextResponse(null,{status:404});
}
export const GET=withRequestPolicy(photo,{feature:'PETS'});
