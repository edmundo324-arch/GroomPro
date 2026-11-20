import {db} from './db';
import {portalSelections,portalAvailability} from './portal-availability';
import {localToInstant} from './operating-hours';
import {onlineStartAllowed} from './online-booking-time';
export const waitlistPrefix='CUSTOMER_WAITLIST:';
export function waitlistDates(from:unknown,through:unknown){
 const valid=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(through)||String(through)<String(from))throw Error('Choose the first and last dates the customer can attend.');return {from:String(from),through:String(through)};
}
export async function joinWaitlist(tenantId:string,customerId:string,locationId:string,input:any,actorUserId?:string){
 if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Reopen the waitlist form before saving.');const dates=waitlistDates(input.from,input.through);
 const notes=String(input.notes||'').trim();if(notes.length>2000)throw Error('Keep waitlist notes within 2,000 characters.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!await tx.customer.findFirst({where:{tenantId,id:customerId,active:true}})||!await tx.location.findFirst({where:{tenantId,id:locationId}}))throw Error('Choose a customer and shop available to your account.');
  const selection=await portalSelections(tenantId,locationId,customerId,input.selections,tx);
  const where={tenantId_settingKey:{tenantId,settingKey:waitlistPrefix+input.id}},old=await tx.tenantSetting.findUnique({where});
  if(old){const v=old.value as any;if(v.customerId!==customerId||v.locationId!==locationId)throw Error('This waitlist entry belongs to another customer or shop.');if(input.revision===undefined)return v;if(input.revision!==v.revision)throw Error('This waitlist entry changed. Refresh before saving; your edits are still here.');if(!['WAITING','CONTACTED'].includes(v.state))throw Error('This waitlist entry is already closed.');const value={...v,...dates,notes,selections:input.selections.map((s:any)=>({petId:s.petId,itemKey:s.itemKey})),durationMin:selection.duration,revision:v.revision+1,updatedAt:new Date().toISOString()};await tx.tenantSetting.update({where,data:{value}});await tx.auditEntry.create({data:{tenantId,actorType:actorUserId?'EMPLOYEE':'SYSTEM',actorUserId:actorUserId||null,entityType:'CUSTOMER',entityId:customerId,customerId,action:'WAITLIST_EDIT',summary:'Updated waitlist choices.',details:{waitlistId:input.id}}});return value;}
  const records=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:waitlistPrefix}}});
  const equivalent=records.find(r=>{const v=r.value as any;return v.customerId===customerId&&v.locationId===locationId&&['WAITING','CONTACTED'].includes(v.state)&&v.from===dates.from&&v.through===dates.through&&JSON.stringify(v.selections)===JSON.stringify(input.selections)});if(equivalent)return equivalent.value;
  const value={id:input.id,customerId,locationId,...dates,notes,selections:input.selections.map((s:any)=>({petId:s.petId,itemKey:s.itemKey})),durationMin:selection.duration,state:'WAITING',revision:1,createdAt:new Date().toISOString(),createdBy:actorUserId||null};
  await tx.tenantSetting.create({data:{tenantId,settingKey:waitlistPrefix+input.id,value}});
  await tx.auditEntry.create({data:{tenantId,actorType:actorUserId?'EMPLOYEE':'SYSTEM',actorUserId:actorUserId||null,entityType:'CUSTOMER',entityId:customerId,customerId,action:'WAITLIST_JOIN',summary:'Added customer to the appointment waitlist.',details:{waitlistId:input.id,locationId}}});return value;
 });
}
export async function readWaitlist(tenantId:string,customerId?:string,locationId?:string){
 const records=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:waitlistPrefix}}});
 const values=records.map(r=>r.value as any).filter(v=>(!customerId||v.customerId===customerId)&&(!locationId||v.locationId===locationId)&&['WAITING','CONTACTED'].includes(v.state));
 const openings=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:values.map(v=>'WAITLIST_OPENING:'+v.id)}}});
 const [customers,locations]=await Promise.all([db.customer.findMany({where:{tenantId,id:{in:values.map(v=>v.customerId)}},select:{id:true,firstName:true,lastName:true}}),db.location.findMany({where:{tenantId,id:{in:values.map(v=>v.locationId)}},select:{id:true,name:true,timezone:true}})]);
 return values.flatMap(v=>{const customer=customers.find(c=>c.id===v.customerId),location=locations.find(l=>l.id===v.locationId);const opening=openings.find(r=>r.settingKey==='WAITLIST_OPENING:'+v.id)?.value as any;return customer&&location?[{...v,customer,location,opening:opening?.entryRevision===v.revision?{...opening,slots:opening.slots.filter((s:any)=>Date.parse(s.start)>Date.now())}:null}]:[]}).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
export async function changeWaitlist(tenantId:string,customerId:string,id:string,revision:number,action:string,actorUserId?:string,ticketId?:string){
 if(!['WITHDRAW','CONTACT','BOOKED'].includes(action)||(!actorUserId&&action!=='WITHDRAW'))throw Error('Choose an available waitlist action.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!await tx.customer.findFirst({where:{tenantId,id:customerId}}))throw Error('Customer unavailable.');const where={tenantId_settingKey:{tenantId,settingKey:waitlistPrefix+id}},row=await tx.tenantSetting.findUnique({where}),v=row?.value as any;
  if(!v||v.customerId!==customerId||!await tx.location.findFirst({where:{tenantId,id:v.locationId}}))throw Error('This waitlist entry is unavailable.');if(v.revision!==revision)throw Error('The waitlist entry changed. Refresh before continuing.');if(!['WAITING','CONTACTED'].includes(v.state))throw Error('This waitlist entry is already closed.');
  if(action==='BOOKED'&&!await tx.ticket.findFirst({where:{tenantId,id:ticketId||'',customerId,locationId:v.locationId,status:{notIn:['CANCELLED','NO_SHOW']},bookingDecision:{notIn:['REQUESTED','PENDING']},scheduledStart:{not:null}}}))throw Error('Choose this customer’s saved appointment at this shop.');
  const value={...v,revision:v.revision+1,state:action==='CONTACT'?'CONTACTED':action==='BOOKED'?'BOOKED':'WITHDRAWN',updatedAt:new Date().toISOString(),...(action==='CONTACT'?{contactedAt:new Date().toISOString(),contactedBy:actorUserId}:{}),...(action==='BOOKED'?{ticketId}:{})};
  await tx.tenantSetting.update({where,data:{value}});await tx.auditEntry.create({data:{tenantId,actorType:actorUserId?'EMPLOYEE':'SYSTEM',actorUserId:actorUserId||null,entityType:'CUSTOMER',entityId:customerId,customerId,action:'WAITLIST_'+action,summary:action==='CONTACT'?'Recorded staff waitlist contact.':action==='BOOKED'?'Linked waitlist entry to a saved appointment.':'Removed customer from active waitlist.',details:{waitlistId:id}}});return value;
 });
}
export async function waitlistOpenings(tenantId:string,entry:any,date:string){
 waitlistDates(date,date);if(date<entry.from||date>entry.through)throw Error('Choose a date within this customer’s waitlist range.');
 const selection=await portalSelections(tenantId,entry.locationId,entry.customerId,entry.selections),available=await portalAvailability(tenantId,entry.locationId,date,selection.duration,selection.serviceType,db,entry.customerId,selection.requiredClasses),slots=[];
 for(let minute=0;minute<1440;minute+=selection.policy.slotIntervalMinutes){let start:Date;try{start=localToInstant(date+'T'+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),available.zone)}catch{continue}if(!onlineStartAllowed(start,available.zone,selection.policy))continue;for(const resource of available.available(start,entry.customerId))slots.push({start:start.toISOString(),resourceKey:resource.kind+':'+resource.id,name:resource.name});}
 return {slots,timezone:available.zone,checkedAt:new Date().toISOString()};
}
