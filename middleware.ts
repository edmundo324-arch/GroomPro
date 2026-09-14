import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const tenant = request.cookies.get("groompro_tenant")?.value;
  if (!tenant || request.headers.get("x-tenant-id")) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set("x-tenant-id", tenant);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"],
};
