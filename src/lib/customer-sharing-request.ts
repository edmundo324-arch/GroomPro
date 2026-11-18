import {NextRequest,NextResponse} from 'next/server';
import {db} from './db';
import {sharingScope,sharingKey,sharedLocations,type SharingConfig} from './customer-sharing-context';
import {checkSharingReferences} from './customer-sharing-query';
export async function withCustomerSharing(request:NextRequest,session:any,run:(request:NextRequest)=>Promise<any>){
 const path=request.nextUrl.pathname;
 // Setup and connector/import handlers have their own authorization and must also work before sharing is configured.
 if(/^\/api\/(import|integrations|setup)(\/|$)/.test(path))return run(request);
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:sharingKey}}}),config=row?.value as SharingConfig|undefined;
 if(!config?.enabled)return run(request);
 if(['/api/customer-location-access','/api/customers/location-access','/api/tenant-settings'].includes(path)&&!['GET','HEAD'].includes(request.method))return NextResponse.json({error:'Customer access is managed in Settings → Locations & hours → Customer sharing.'},{status:409});
 if(['/api/customer-sharing','/api/tenant-export','/api/locations','/api/employee/session','/api/workflow-settings','/api/module-layouts','/api/operating-hours','/api/tenant-settings','/api/platform-access'].includes(path)||(['/api/reports','/api/customer-agreement/staff'].includes(path)&&request.nextUrl.searchParams.has('locations'))||/^\/api\/(import|integrations|setup)(\/|$)/.test(path))return run(request);
 if(['PLATFORM_OWNER','DEVELOPER'].includes(session?.user.role))return run(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const explicit=request.nextUrl.searchParams.get('locationId'),assigned=session.user.locationId;
 if(explicit&&assigned&&explicit!==assigned&&!['ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'This view belongs to another shop. Ask a manager to review your location access.'},{status:403});
 const locationId=explicit||assigned||(config.groups.flatMap(g=>g.locationIds).length===1?config.groups[0].locationIds[0]:'');
 const locations=sharedLocations(config,locationId);
 if(!locations.length)return NextResponse.json({error:'Choose your shop location before opening customer records.'},{status:400});
 const url=new URL(request.url);if(!explicit)url.searchParams.set('locationId',locationId);
 const effective=new NextRequest(url,request.clone());
 return sharingScope.run({tenantId,locationId,locations},async()=>{
  try{
   const refs:any=Object.fromEntries(request.nextUrl.searchParams.entries());
   if(refs.customer)refs.customerId=refs.customer;
   if(refs.pet)refs.petId=refs.pet;
   const kind=path.split('/')[2];
   const entityKey=({customers:'customerId',pets:'petId',tickets:'ticketId'} as any)[kind];
   if(entityKey&&refs.id)refs[entityKey]=refs.id;
   if(!['GET','HEAD','OPTIONS'].includes(request.method)){
    const body=await request.clone().json().catch(()=>null);if(body){if(entityKey&&body.id)body[entityKey]=body.id;await checkSharingReferences(db,body);}
   }
   await checkSharingReferences(db,refs);
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not check shop access. Try again.'},{status:403});}
  return run(effective);
 });
}
