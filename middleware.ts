import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const tenant = request.cookies.get("groompro_tenant")?.value;
  const headers = new Headers(request.headers);
  if(tenant&&!headers.has("x-tenant-id"))headers.set("x-tenant-id", tenant);
  headers.set("x-groompro-method",request.method);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"],
};
