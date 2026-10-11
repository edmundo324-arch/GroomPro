import {requestMaterial} from './src/lib/request-fingerprint';
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const tenant = request.cookies.get("groompro_tenant")?.value;
  const headers = new Headers(request.headers);
  if(tenant&&!headers.has("x-tenant-id"))headers.set("x-tenant-id", tenant);
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
};
