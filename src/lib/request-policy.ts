import {platformRestriction} from './platform-restrictions';
import {requestAuthorization} from './request-authorization';
import {NextRequest,NextResponse} from 'next/server';
import {db} from './db';
import {getActiveEmployeeSession} from './employee-session';
import {moduleDenial} from './module-entitlement';

// One request owns one authorization result. Nested services do not consume
// another per-action PIN or manager approval. Nothing is cached across requests.
type Policy={feature?:string|((request:NextRequest)=>Promise<string|undefined>);configure?:boolean};
export async function actionPermissions(request:NextRequest,configure=false):Promise<Array<'VIEW'|'CREATE'|'EDIT'|'DELETE'|'CONFIGURE'>>{
 if(['GET','HEAD','OPTIONS'].includes(request.method))return ['VIEW'];
 if(configure)return ['CONFIGURE'];
 const path=request.nextUrl?.pathname||'';
 if(path==='/api/pos-operation'){
  const body=await request.clone().json().catch(()=>({}));
  if(body.kind==='REBOOK')return ['CREATE'];
  if(body.kind==='SAVE')return [body.ticketId?'EDIT':'CREATE'];
  return body.ticketId?['EDIT']:['CREATE','EDIT'];
 }
 if(request.method==='DELETE')return ['DELETE'];
 if(request.method==='POST'&&['/api/whiteboard','/api/tickets/checkout','/api/tickets/no-show','/api/tickets/account-credit','/api/tickets/daycare','/api/customers/account','/api/customers/rewards'].includes(path))return ['EDIT'];
 return [request.method==='POST'?'CREATE':'EDIT'];
}
export function withRequestPolicy<A extends unknown[]>(handler:(request:NextRequest,...args:A)=>Promise<any>,policy:Policy={}){
 return (request:NextRequest,...args:A)=>requestAuthorization.run(new Map(),async()=>{
  const feature=typeof policy.feature==='function'?await policy.feature(request):policy.feature;
  if(feature){const denial=await moduleDenial(request,feature);if(denial)return denial;}
  const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
  if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
  const read=['GET','HEAD','OPTIONS'].includes(request.method);
  const sid=request.cookies.get('groompro_session')?.value;
  const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
  const restriction=await platformRestriction(tenantId,session?.user.id);
  if(restriction&&session?.user.role!=='DEVELOPER')return NextResponse.json({error:restriction},{status:403});
  // Preserve existing public/read-only workflows; their handlers retain any
  // stronger checks. All internal mutations require an authenticated employee.
  if(!read&&!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
  if(session && session.user.role!=='DEVELOPER'){
   const codes=await actionPermissions(request,policy.configure);
   const permissions=await Promise.all(codes.map(permissionCode=>db.rolePermission.findUnique({where:{tenantId_role_permissionCode:{tenantId,role:session.user.role,permissionCode}}})));
   // Unconfigured permissions keep existing route defaults; an explicit denial
   // cannot be bypassed through a second screen or endpoint.
   if(permissions.some(permission=>permission?.enabled===false))return NextResponse.json({error:'Your role does not have permission for this action.'},{status:403});
  }
  return handler(request,...args);
 });
}

export async function catalogFeature(request:NextRequest){
 if(['GET','HEAD'].includes(request.method))return undefined; // shared POS lookup
 const body=await request.clone().json().catch(()=>({}));
 return body.kind==='products'?'INVENTORY':'TICKETS';
}
