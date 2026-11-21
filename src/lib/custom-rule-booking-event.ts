import {selectCustomerRule} from './custom-rule-pet-targets';
import {unfinishedBookingPrefix,unfinishedBookingDue} from './unfinished-bookings';
import {type ExecutableCustomRule} from './custom-rule-plan';
export async function loadBookingRulePlan(client:any,tenantId:string,row:any,policy:any,rules:ExecutableCustomRule[],now=new Date()){
 const value=row.value;if(!unfinishedBookingDue(value,policy.unfinishedBookingMinutes,now))return null;
  const [customer,location]=await Promise.all([client.customer.findFirst({where:{tenantId,id:value.customerId,active:true}}),client.location.findFirst({where:{tenantId,id:value.locationId}})]);if(!customer||!location)return null;
  const [tags,vip,upcoming,pets]=await Promise.all([client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}}),client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}}),client.pet.findMany({where:{tenantId,customerId:customer.id,id:{in:[...new Set((value.choices?.selections||[]).map((s:any)=>s.petId).filter(Boolean))]}},select:{name:true}})]);
  const eventId='unfinished:'+row.settingKey.slice(unfinishedBookingPrefix.length)+':'+value.lastActivityAt,occurredAt=new Date(Date.parse(value.lastActivityAt)+policy.unfinishedBookingMinutes*60000).toISOString();
  const plan=await selectCustomerRule(client,tenantId,customer.id,rules,{id:eventId,event:'BOOKING_ABANDONED',occurredAt,locationId:location.id,current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]}},now);
 return plan?{plan,customer,location,pets,eventId}:null;
}
