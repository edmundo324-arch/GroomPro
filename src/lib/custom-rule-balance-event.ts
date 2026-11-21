import type {CustomRuleEventContext} from './custom-rule-plan';
export function outstandingIncrease(current:number,later:any[]){
 if(!Number.isSafeInteger(current)||current<=0||later.some(r=>!Number.isSafeInteger(Number(r.amountCents))))return false;
 let balance=current-later.reduce((n,r)=>n+Number(r.amountCents),0);if(balance<=0)return false;
 for(const row of later){balance+=Number(row.amountCents);if(balance<=0)return false;}return true;
}
export async function loadBalanceRuleEvent(client:any,tenantId:string,entry:any,now=new Date()){
  const customer=await client.customer.findFirst({where:{tenantId,id:entry.customerId,active:true}});if(!customer||Number(customer.balanceCents)<=0)return null;
  const stillOwed=async(tx:any)=>{const live=await tx.customer.findFirst({where:{tenantId,id:customer.id,active:true}});if(!live)return false;const later=await tx.$queryRaw`SELECT amountCents FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND customerId=${customer.id} AND entryType='OWED' AND (createdAt>${entry.createdAt} OR (createdAt=${entry.createdAt} AND id>${entry.id})) ORDER BY createdAt,id`;return outstandingIncrease(Number(live.balanceCents),later);};if(!await stillOwed(client))return null;
  const [home,locations,tags,vip,upcoming]=await Promise.all([client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}}),client.location.findMany({where:{tenantId},select:{id:true,timezone:true}}),client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}}),client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}})]);
  const location=locations.find((l:any)=>l.id===home?.value?.locationId)||(locations.length===1?locations[0]:null);if(!location)throw Error('Choose this customer’s home shop before sending a balance reminder.');
  const eventId='balance-increase:'+entry.id,context:CustomRuleEventContext={id:eventId,event:'BALANCE_DUE',occurredAt:new Date(entry.createdAt).toISOString(),locationId:location.id,current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]}};
 return {customer,location,eventId,context,stillOwed};
}
