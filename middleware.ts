import {requestMaterial} from './src/lib/request-fingerprint';
import { NextRequest, NextResponse } from "next/server";
import {businessCookie,businessId,deviceCookie,mayOpenBusinessWithoutPin,sessionCookie} from './src/lib/business-context';

export async function middleware(request: NextRequest) {
  const tenant = request.cookies.get(businessCookie)?.value;
  const selected=request.headers.get('x-tenant-id')||tenant||process.env.GROOMPRO_DEV_TENANT_ID;
  const headers = new Headers(request.headers);
  if(tenant&&!headers.has("x-tenant-id"))headers.set("x-tenant-id", tenant);
  if((businessId(selected)||businessId(tenant))&&request.nextUrl.pathname!=='/api/integrations/123pet/connector'){
    // Pilot business reads require the same verified context as edits.
    if(tenant!==selected)return NextResponse.json({error:'Open the business workspace first.'},{status:403});
    const session=request.cookies.get(sessionCookie)?.value||'';
    const device=request.cookies.get(deviceCookie)?.value||'';
    const readSession=request.nextUrl.pathname==='/api/employee/session'&&request.method==='GET';
    if(!mayOpenBusinessWithoutPin(request.nextUrl.pathname,request.method)||(readSession&&session)){
      const denied=()=>readSession?NextResponse.json({employee:null}):NextResponse.json({error:'Employee PIN is required.'},{status:401});
      if(!session||!device)return denied();
      const [{db},{currentBusinessSession}]=await Promise.all([import('./src/lib/db'),import('./src/lib/platform-business')]);
      if(!await currentBusinessSession(db,tenant!,session,device))return denied();
    }
  }
  headers.set("x-groompro-method",request.method);
  headers.delete('x-groompro-request-hash');
  if(headers.has('x-groompro-approval')) {
    const body=['GET','HEAD'].includes(request.method)?'':await request.clone().text();
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(requestMaterial(request.method,request.url,body)));
    headers.set('x-groompro-request-hash',Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"],
  runtime: "nodejs",
};
