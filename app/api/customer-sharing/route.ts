import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {sharingKey,validateGroups,sharedLocations,type SharingConfig} from '@/src/lib/customer-sharing-context';
const where=(tenantId:string,settingKey:string)=>({tenantId_settingKey:{tenantId,settingKey}});
async function inventory(tx:any,tenantId:string){
 const [locations,customers,settings,tickets,row]=await Promise.all([tx.location.findMany({where:{tenantId},select:{id:true,name:true}}),tx.customer.findMany({where:{tenantId},select:{id:true,firstName:true,lastName:true}}),tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'CUSTOMER_HOME_LOCATION:'}}}),tx.ticket.findMany({where:{tenantId,scheduledStart:{not:null}},select:{customerId:true,locationId:true},orderBy:[{scheduledStart:'asc'},{id:'asc'}]}),tx.tenantSetting.findUnique({where:where(tenantId,sharingKey)})]);
 const homes=new Map(settings.map((s:any)=>[s.settingKey.slice('CUSTOMER_HOME_LOCATION:'.length),(s.value as any).locationId])),suggestions=new Map<string,string>();
 for(const ticket of tickets)if(!suggestions.has(ticket.customerId))suggestions.set(ticket.customerId,ticket.locationId);
 const config:SharingConfig=row?.value||{enabled:false,revision:0,groups:locations.map((l:any)=>({id:l.id,name:l.name,locationIds:[l.id]}))};
 return {locations,config,customers:customers.map((c:any)=>({...c,locationId:homes.get(c.id)||'',suggestedLocationId:suggestions.get(c.id)||''}))};
}
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Ask an owner or manager to change customer sharing.'},{status:403});
 const tenantId=session.tenantId;
 try{
 if(r.method==='GET')return NextResponse.json(await inventory(db,tenantId),{headers:{'Cache-Control':'no-store'}});
 const input=await r.json();
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await inventory(tx,tenantId);
  if(input.revision!==current.config.revision)throw Error('Sharing settings changed on another screen. Reopen this page before saving.');
  const groups=validateGroups(input.groups,current.locations.map((l:any)=>l.id));
  const config:SharingConfig={enabled:input.enabled===true,revision:current.config.revision+1,groups};
  if(!input.assignments||typeof input.assignments!=='object'||Array.isArray(input.assignments))throw Error('Review customer assignments before saving.');
  const customerIds=new Set(current.customers.map((c:any)=>c.id)),locationIds=new Set(current.locations.map((l:any)=>l.id));
  for(const [id,locationId] of Object.entries(input.assignments))if(!customerIds.has(id)||typeof locationId!=='string'||(locationId!==''&&!locationIds.has(locationId)))throw Error('Choose customers and shops from this business.');
  const assignments=current.customers.map((c:any)=>({customerId:c.id,locationId:input.assignments[c.id]??c.locationId}));
  if(config.enabled&&assignments.some((a:any)=>!a.locationId))throw Error('Assign every customer to a shop before turning on sharing groups. Customers without appointments can be assigned in bulk.');
  for(const assignment of assignments)if(assignment.locationId&&current.customers.find((c:any)=>c.id===assignment.customerId)?.locationId!==assignment.locationId){
   await tx.tenantSetting.upsert({where:where(tenantId,'CUSTOMER_HOME_LOCATION:'+assignment.customerId),create:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+assignment.customerId,value:{locationId:assignment.locationId}},update:{value:{locationId:assignment.locationId}}});
  }
  for(const assignment of assignments)if(!assignment.locationId)await tx.tenantSetting.deleteMany({where:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+assignment.customerId}});
  await tx.tenantSetting.upsert({where:where(tenantId,'CUSTOMER_ACCESS_MODE'),create:{tenantId,settingKey:'CUSTOMER_ACCESS_MODE',value:config.enabled?'EXPLICIT':'SHARED'},update:{value:config.enabled?'EXPLICIT':'SHARED'}});
  await tx.customerLocationAccess.deleteMany({where:{tenantId}});
  const access=assignments.flatMap((a:any)=>sharedLocations(config,a.locationId).map(locationId=>({tenantId,customerId:a.customerId,locationId})));
  for(let i=0;i<access.length;i+=1000)await tx.customerLocationAccess.createMany({data:access.slice(i,i+1000),skipDuplicates:true});
  await tx.tenantSetting.upsert({where:where(tenantId,sharingKey),create:{tenantId,settingKey:sharingKey,value:config as any},update:{value:config as any}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'CUSTOMER_SHARING',summary:'Updated customer sharing groups and reviewed customer assignments.',details:{enabled:config.enabled,groups,assignedCustomers:assignments.length}}});
  return inventory(tx,tenantId);
 },{timeout:120000});
 return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save customer sharing. Your saved assignments have not changed.'},{status:400});}
}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
