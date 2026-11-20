import type {PortalBookingDraft} from './portal-booking-draft';
import {db} from './db';
import {readPortalPolicy} from './portal-policy-store';
export const bookingStages={STARTED:'Opened booking',DOGS_SERVICES:'Choosing dogs and services',DATE:'Choosing a date',TIMES:'Reviewing available times',TIME_SELECTED:'Selected a time'} as const;
export type BookingStage=keyof typeof bookingStages;
export function bookingStage(value:unknown):BookingStage{if(typeof value==='string'&&Object.hasOwn(bookingStages,value))return value as BookingStage;throw Error('Refresh the booking form before continuing.');}
export const unfinishedBookingPrefix='PORTAL_UNFINISHED:';
export function unfinishedBookingDue(value:any,minutes:number,now=new Date()){
 return value?.state==='ACTIVE'&&Number.isFinite(Date.parse(value.lastActivityAt))&&Date.parse(value.lastActivityAt)<=+now-minutes*60000;
}
export async function recordBookingActivity(tenantId:string,customerId:string,locationId:string,attemptId:string,complete=false,stage?:unknown,choices?:PortalBookingDraft,expectedRevision?:number,completedTicketId?:string){
 const nextStage=stage===undefined?undefined:bookingStage(stage);
 if(!/^[a-f0-9-]{36}$/i.test(attemptId))throw Error('Refresh the booking form before continuing.');
 const policy=await readPortalPolicy(tenantId);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
  const where={tenantId_settingKey:{tenantId,settingKey:unfinishedBookingPrefix+attemptId}},row=await tx.tenantSetting.findUnique({where}),old=row?.value as any;
  if(old&&(old.customerId!==customerId||old.locationId!==locationId))throw Error('Refresh the booking form before continuing.');
  if(old?.state==='COMPLETED')return {revision:old.revision||0,completed:true};
  if(choices&&!complete&&expectedRevision!==(old?.revision||0))throw Error('Your saved booking choices changed on another device. Sign in again to review them before replacing anything.');
  const now=new Date().toISOString(),value={...old,...(old?.lastActivityAt&&Date.parse(old.lastActivityAt)<=Date.now()-policy.unfinishedBookingMinutes*60000?{resumedAfterInactivityAt:old.resumedAfterInactivityAt||now,inactivityMinutes:old.inactivityMinutes||policy.unfinishedBookingMinutes}:{}),customerId,locationId,revision:(old?.revision||0)+1,...(choices?{choices}:{}),...(complete&&completedTicketId?{ticketId:completedTicketId,completedAt:new Date().toISOString()}:{}),stage:nextStage||old?.stage||'STARTED',state:complete?'COMPLETED':'ACTIVE',startedAt:old?.startedAt||now,lastActivityAt:now};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:where.tenantId_settingKey.settingKey,value},update:{value}});
  return {revision:value.revision,completed:complete};
 });
}
export async function unfinishedBookings(tenantId:string){
 const [policy,records]=await Promise.all([readPortalPolicy(tenantId),db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix}}})]);
 const due=records.filter(r=>unfinishedBookingDue(r.value,policy.unfinishedBookingMinutes));
 const values=due.map(r=>r.value as any);
 const [customers,locations]=await Promise.all([db.customer.findMany({where:{tenantId,id:{in:values.map(v=>v.customerId)}},select:{id:true,firstName:true,lastName:true}}),db.location.findMany({where:{tenantId,id:{in:values.map(v=>v.locationId)}},select:{id:true,name:true,timezone:true}})]);
 // Scoped customer/location reads prevent the follow-up list exposing another sharing group.
 return due.flatMap(r=>{const v=r.value as any,customer=customers.find(c=>c.id===v.customerId),location=locations.find(l=>l.id===v.locationId);return customer&&location?[{id:r.settingKey.slice(unfinishedBookingPrefix.length),customer,location,stage:bookingStages[v.stage as BookingStage]||bookingStages.STARTED,lastActivityAt:v.lastActivityAt}]:[]});
}
export async function reviewUnfinishedBooking(tenantId:string,attemptId:string,userId:string,expectedActivity:string){
 if(!/^[a-f0-9-]{36}$/i.test(attemptId))throw Error('Refresh the unfinished bookings list before continuing.');
 return db.$transaction(async tx=>{
  const where={tenantId_settingKey:{tenantId,settingKey:unfinishedBookingPrefix+attemptId}};
  const initial=await tx.tenantSetting.findUnique({where}),first=initial?.value as any;
  if(!first)throw Error('This unfinished booking is no longer available. Refresh the list.');
  const customer=await tx.customer.findFirst({where:{tenantId,id:first.customerId},select:{id:true}});
  const location=await tx.location.findFirst({where:{tenantId,id:first.locationId},select:{id:true}});
  if(!customer||!location)throw Error('This customer is not available at your current location.');
  await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customer.id} AND tenantId=${tenantId} FOR UPDATE`;
  const row=await tx.tenantSetting.findUnique({where}),value=row?.value as any;
  if(value?.state!=='ACTIVE')return;
  if(value.lastActivityAt!==expectedActivity)throw Error('The customer has resumed booking. Refresh the list before marking follow-up complete.');
  await tx.tenantSetting.update({where,data:{value:{...value,state:'REVIEWED',reviewedAt:new Date().toISOString(),reviewedBy:userId}}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'CUSTOMER',entityId:customer.id,customerId:customer.id,action:'BOOKING_FOLLOWUP_REVIEWED',summary:'Marked unfinished online booking follow-up complete.',details:{attemptId}}});
 });
}

export async function latestBookingDraft(tenantId:string,customerId:string,locationId:string,petIds:string[]){
 const records=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix}}});
 const rows=records.map(r=>({id:r.settingKey.slice(unfinishedBookingPrefix.length),value:r.value as any})).filter(r=>r.value.customerId===customerId&&r.value.locationId===locationId&&['ACTIVE','REVIEWED'].includes(r.value.state)&&r.value.choices).sort((a,b)=>String(b.value.lastActivityAt).localeCompare(String(a.value.lastActivityAt)));
 const row=rows[0];if(!row)return null;
 return {attemptId:row.id,revision:row.value.revision||0,lastActivityAt:row.value.lastActivityAt,choices:{...row.value.choices,selections:row.value.choices.selections.filter((s:any)=>petIds.includes(s.petId))}};
}
