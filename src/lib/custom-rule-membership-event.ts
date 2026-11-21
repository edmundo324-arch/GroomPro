import {type CustomRuleEvent} from './custom-rule-policy';
export function membershipRuleEvent(audit:any):CustomRuleEvent|null{
 if(audit.entityType!=='MEMBERSHIP')return null;
 return ({MEMBERSHIP_STARTED:'MEMBERSHIP_STARTED',MEMBERSHIP_CANCEL:'MEMBERSHIP_CANCEL_REQUESTED',MEMBERSHIP_PAUSE:'MEMBERSHIP_PAUSE_REQUESTED',MEMBERSHIP_RESUME:'MEMBERSHIP_RESUMED'} as Record<string,CustomRuleEvent>)[audit.action]||null;
}
export function membershipRuleEventCurrent(audit:any,m:any,latestId:string){
 if(!m||m.tenantId!==audit.tenantId||m.id!==audit.entityId||latestId!==audit.id||audit.customerId&&audit.customerId!==m.customerId)return false;
 const event=membershipRuleEvent(audit),active=['ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED'].includes(m.status);
 if(event==='MEMBERSHIP_STARTED')return active&&!m.endedAt;
 if(event==='MEMBERSHIP_RESUMED')return m.status==='ACTIVE'&&!m.endedAt;
 if(event==='MEMBERSHIP_CANCEL_REQUESTED')return m.status==='CANCELLATION_REQUESTED'&&!!m.cancelRequestedAt&&!!audit.details?.requestReceivedAt&&+new Date(m.cancelRequestedAt)===+new Date(audit.details.requestReceivedAt);
 if(event==='MEMBERSHIP_PAUSE_REQUESTED')return m.status==='PAUSE_REQUESTED'&&!!m.pauseRequestedAt&&!!audit.details?.requestReceivedAt&&+new Date(m.pauseRequestedAt)===+new Date(audit.details.requestReceivedAt);
 return false;
}
export async function loadMembershipRuleEvent(client:any,tenant:any,audit:any){
 const tenantId=tenant.id,rows=await client.$queryRaw`SELECT * FROM Membership WHERE tenantId=${tenantId} AND id=${audit.entityId} LIMIT 1`,membership=rows[0];
 const recent=await client.auditEntry.findMany({where:{tenantId,entityType:'MEMBERSHIP',entityId:audit.entityId,action:audit.action},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:1});
 if(!membershipRuleEventCurrent(audit,membership,recent[0]?.id||''))return null;
 const customer=await client.customer.findFirst({where:{tenantId,id:membership.customerId,active:true}});if(!customer)return null;
 const [home,locations,pet,tags,upcoming,vip]=await Promise.all([
 client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}}),
 client.location.findMany({where:{tenantId},select:{id:true,timezone:true}}),
 client.pet.findFirst({where:{tenantId,id:membership.petId,customerId:customer.id},select:{name:true}}),
 client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}}),
 client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}}),
 client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`
 ]);
 const location=locations.find((l:any)=>l.id===home?.value?.locationId)||(locations.length===1?locations[0]:null);if(!location)throw Error('Choose this customer’s home shop before running a membership follow-up.');
 return {context:{id:audit.id,event:membershipRuleEvent(audit)!,occurredAt:new Date(audit.occurredAt).toISOString(),locationId:location.id,current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]}},customerId:customer.id,timezone:location.timezone,values:{customerName:[customer.firstName,customer.lastName].filter(Boolean).join(' '),businessName:tenant.name,membershipName:membership.name,...(pet?{petName:pet.name}:{}),balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(customer.balanceCents)/100)}};
}
