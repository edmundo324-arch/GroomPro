import {requestBusinessHost,conflictsWithBusiness} from './src/lib/business-host';
import {siteRole,allowsHost,validateDeployment} from './src/lib/site-deployment';
import {requestMaterial} from './src/lib/request-fingerprint';
import { NextRequest, NextResponse } from "next/server";
import {businessCookie,businessId,deviceCookie,mayOpenBusinessWithoutPin,sessionCookie} from './src/lib/business-context';

export async function middleware(request: NextRequest) {
  const path=request.nextUrl.pathname;
  // Background workers use loopback rather than a public business hostname.
  const internalWorker=['/api/internal/appointment-messages','/api/internal/scheduled-reports'].includes(path)&&request.method==='POST'&&['127.0.0.1','localhost'].includes((request.headers.get('host')||'').replace(/:\d+$/,''))&&Boolean(process.env.GROOMPRO_SCHEDULER_TOKEN)&&request.headers.get('x-groompro-scheduler')===process.env.GROOMPRO_SCHEDULER_TOKEN;
  if(internalWorker&&['current','tenant'].includes(siteRole()))return NextResponse.next();
  let role;try{role=siteRole();validateDeployment();if(!allowsHost(request.headers.get('host')))return NextResponse.json({error:'This address does not belong to this GroomPro site.'},{status:404});}catch{return NextResponse.json({error:'This GroomPro site is not ready. Ask the platform owner to complete its setup.'},{status:503});}
  if(role==='sales')return path==='/'?NextResponse.next():NextResponse.json({error:'This page is not available on the sales site.'},{status:404});
  if(!path.startsWith('/api/')){const response=NextResponse.next();if(['admin','development','staging'].includes(role)){response.headers.set('X-Robots-Tag','noindex, nofollow');response.headers.set('Cache-Control','no-store');}return response;}
  if(['admin','development','staging'].includes(role)){
    const signIn=(path==='/api/setup/context'&&request.method==='GET')||path==='/api/employee/session'||path==='/api/device-authorization';
    if(!signIn){
      const tenant=request.cookies.get(businessCookie)?.value,session=request.cookies.get(sessionCookie)?.value,device=request.cookies.get(deviceCookie)?.value;
      if(!tenant||!session||!device)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
      if(request.headers.get('x-tenant-id')&&request.headers.get('x-tenant-id')!==tenant)return NextResponse.json({error:'Open the business workspace first.'},{status:403});
      const [{db},{currentBusinessSession}]=await Promise.all([import('./src/lib/db'),import('./src/lib/platform-business')]);
      const identity=await currentBusinessSession(db,tenant,session,device);
      if(!identity)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
      if(role!=='staging'&&!['PLATFORM_OWNER','DEVELOPER'].includes(identity.user.role))return NextResponse.json({error:'Platform Owner or Developer access is required for this site.'},{status:403});
    }
  }
  let hostRoute;try{hostRoute=requestBusinessHost(request)}catch{return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'Business address routing is not configured correctly. Contact GroomPro support.'},{status:503,headers:{'Cache-Control':'no-store'}})}
  if(hostRoute.kind==='unknown')return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'This business address is not configured. Use your existing GroomPro address.'},{status:404,headers:{'Cache-Control':'no-store'}});
  if(hostRoute.kind==='business'){
    const tenantId=hostRoute.tenantId,path=request.nextUrl.pathname;
    const selectors=[request.headers.get('x-tenant-id'),request.cookies.get(businessCookie)?.value,...request.nextUrl.searchParams.getAll('tenantId'),...request.nextUrl.searchParams.getAll('tenant')];
    if(conflictsWithBusiness(tenantId,selectors))return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'This address belongs to a different business. Open the correct business address.'},{status:403,headers:{'Cache-Control':'no-store'}});
    if(path==='/api/setup/context'&&request.method==='GET'){
      const headers=new Headers(request.headers);headers.set('x-tenant-id',tenantId);
      return NextResponse.next({request:{headers}});
    }
    const switchingBusiness=path==='/api/platform-access'&&!['GET','HEAD'].includes(request.method)&&['OPEN_BUSINESS','RETURN_HOME'].includes((await request.clone().json().catch(()=>({}))).action);
    if(path.startsWith('/api/setup/')||switchingBusiness){
      // Platform business switching and provisioning stay on the existing shared address.
      return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'Use the main GroomPro address for business setup or platform access changes.'},{status:409});
    }
    if(['/api/customer-portal','/api/customer-agreement','/api/device-authorization'].includes(path)&&request.method==='POST'){
      const body=await request.clone().json().catch(()=>null);
      if(body&&conflictsWithBusiness(tenantId,[body.tenant,body.tenantId]))return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'Use this business’s form or sign-in link.'},{status:403});
    }
    const publicPost=['/api/customer-portal','/api/customer-agreement','/api/device-authorization','/api/integrations/resend','/api/internal/appointment-messages'].includes(path)&&request.method==='POST';
    if(!publicPost&&!request.cookies.get(businessCookie)?.value)return NextResponse.json({code:'BUSINESS_HOST_ROUTING',error:'Open this business’s GroomPro page before continuing.'},{status:409});
  }
  // The native launcher authenticates this endpoint with its private per-process credential.
  if(request.nextUrl.pathname==='/api/internal/appointment-messages'&&request.method==='POST')return NextResponse.next();
  // Provider callbacks authenticate their raw payload with the tenant's signing secret.
  if(request.nextUrl.pathname==='/api/integrations/resend'&&request.method==='POST')return NextResponse.next();
  // Customer agreements use a tenant-scoped, expiring capability instead of an employee session.
  if(['/api/customer-agreement','/api/customer-portal'].includes(request.nextUrl.pathname)&&request.method==='POST')return NextResponse.next();
  if(request.nextUrl.pathname==='/api/device-authorization'&&['GET','POST'].includes(request.method))return NextResponse.next();
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
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico).*)"],
  runtime: "nodejs",
};
