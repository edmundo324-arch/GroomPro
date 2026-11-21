import {db} from './db';
import {Prisma} from '@prisma/client';
import {employeeLocationContext} from './employee-shift-location';
import {type ReportHistoryPart} from './offline-report-history';
const prefixes=['TICKET_REFUND:','TICKET_VOID:','TICKET_TIPS:','CUSTOMER_REFERRAL:','CUSTOMER_DEPOSIT:','PORTAL_CANCELLATION:','GROOMING_PROGRESS:','PREPAID_PURCHASE:','GIFT_CARD:','PORTAL_UNFINISHED:','CUSTOM_RULE_DELIVERY:','CUSTOM_RULE:','STAFF_TASK:'];
const pick=(v:any,keys:string[])=>Object.fromEntries(keys.map(k=>[k,v?.[k]]));
export function reportingSetting(row:any,customers:Set<string>,tickets:Set<string>,employees:Set<string>,manager:boolean,userId:string,locationId:string){
 const k=row.settingKey,v=row.value||{};let value:any=null;
 if(k==='CUSTOMER_RETENTION_WEEKS')value=row.value;
 else if(k.startsWith('TIME_CLOCK:')){if(employees.has(k.slice(11)))value=v;}
 else if(k.startsWith('CUSTOMER_REFERRAL:')){if(customers.has(k.slice(18)))value=pick(v,['referralSource']);}
 else if(k.startsWith('CUSTOM_RULE:'))value=pick(v,['id','name']);
 else if(k.startsWith('STAFF_TASK:')){if(manager||v.assigneeId===userId)value=pick(v,['id','completedAt']);}
 else if(k.startsWith('CUSTOM_RULE_DELIVERY:')){if(customers.has(v.customerId))value=pick(v,['ruleId','communicationId','customerId','recordedAt']);}
 else if(k.startsWith('GIFT_CARD:'))value=pick(v,['id','last4','state','activatedAt','faceValueCents','entries']);
 else if(k.startsWith('PREPAID_PURCHASE:')){if(customers.has(v.customerId))value=pick(v,['id','state','customerId','petId','offer','entries','visitValuesCents','visitsRemaining','used','expiresOn']);}
 else if(k.startsWith('PORTAL_UNFINISHED:')){if(customers.has(v.customerId)&&v.locationId===locationId)value=pick(v,['state','startedAt','stage','resumedAfterInactivityAt','ticketId','customerId','locationId','completedAt']);}
 else if(k.startsWith('CUSTOMER_DEPOSIT:')){if(customers.has(v.customerId)&&v.locationId===locationId)value=pick(v,['id','customerId','locationId','recordedAt','amountCents']);}
 else if(k.startsWith('PORTAL_CANCELLATION:')){if(tickets.has(k.slice(20)))value=pick(v,['state']);}
 else if(k.startsWith('TICKET_TIPS:')){if(tickets.has(k.slice(12)))value=pick(v,['shares']);}
 else if(tickets.has(v.ticketId)){if(k.startsWith('TICKET_REFUND:'))value=pick(v,['id','ticketId','locationId','orderNumber','recordedAt','method','totalCents','taxCents','tipCents','reason','items','tipReversals']);else if(k.startsWith('TICKET_VOID:'))value=pick(v,['ticketId','locationId','recordedAt','totalCents','orderNumber','reason','actorUserId']);else if(k.startsWith('GROOMING_PROGRESS:'))value=pick(v,['ticketId','petId','stages']);}
 return value===null?null:{id:row.id,settingKey:k,value};
}
export async function reportHistoryPage(tenantId:string,locationId:string,userId:string,manager:boolean,hideOwners:boolean,part:ReportHistoryPart,after:string,client:any=db){
 const page={orderBy:{id:'asc'},take:250},id=after?{gt:after}:undefined;
 const customers=['memberships','membershipRequests','membershipPayments','accountEntries','audits','messages'].includes(part)?await client.customer.findMany({where:{tenantId},select:{id:true}}):[],customerIds=customers.map((c:any)=>c.id),allowedCustomers=new Set<string>(customerIds);
 const employeeWhere={tenantId,...(!manager?{id:userId}:hideOwners?{role:{not:'PLATFORM_OWNER'}}:{})};
 let rows:any[]=[];
 if(part==='customers')rows=await client.customer.findMany({...page,where:{tenantId,...(id?{id}:{})},select:{id:true,firstName:true,lastName:true,active:true,createdAt:true,balanceCents:true,creditCents:true}});
 if(part==='tickets')rows=await client.ticket.findMany({...page,where:{tenantId,locationId,...(id?{id}:{})},select:{id:true,customerId:true,locationId:true,orderNumber:true,scheduledStart:true,createdAt:true,closedAt:true,status:true,bookingDecision:true,totalCents:true,tipCents:true,salesTaxCents:true,accountCreditCents:true,noShowFeeCents:true,noShowFeeProcessedAt:true,customer:{select:{firstName:true,lastName:true,active:true}},pets:{select:{petId:true}},payments:{select:{id:true,amount:true}},lines:{select:{id:true,ticketId:true,lineType:true,role:true,sourceKey:true,serviceId:true,productId:true,petId:true,description:true,quantity:true,unitPriceCents:true,discountCents:true,totalCents:true,commissionCents:true,durationMin:true,assignedUserId:true,packageId:true,packageGroupKey:true,packageName:true,service:{select:{name:true}},assignedUser:{select:{id:true,firstName:true,lastName:true,displayName:true}}}}}});
 if(part==='visits')rows=await client.ticket.findMany({...page,where:{tenantId,...(id?{id}:{})},select:{id:true,customerId:true,status:true,bookingDecision:true,createdAt:true,closedAt:true,scheduledStart:true,lines:{select:{lineType:true,role:true,petId:true}}}});
 if(part==='payments')rows=await client.payment.findMany({...page,where:{tenantId,ticket:{tenantId,locationId},...(id?{id}:{})},select:{id:true,ticketId:true,amount:true,paymentType:true,paidAt:true,ticket:{select:{orderNumber:true}}}});
 if(part==='employees')rows=await client.user.findMany({...page,where:{AND:[employeeWhere,...(id?[{id}]:[])]},select:{id:true,firstName:true,lastName:true,displayName:true,locationId:true}});
 if(part==='products')rows=await client.product.findMany({...page,where:{tenantId,...(id?{id}:{})},select:{id:true,name:true,sku:true,active:true,quantity:true,costCents:true,priceCents:true}});
 let raw:any[]|undefined;
 if(part==='settings'){
  const staff=await client.user.findMany({where:employeeWhere,select:{id:true}}),staffIds=staff.map((e:any)=>e.id);
  raw=await client.tenantSetting.findMany({...page,where:{tenantId,...(id?{id}:{}),OR:[{settingKey:'CUSTOMER_RETENTION_WEEKS'},{settingKey:{in:staffIds.map((e:string)=>'TIME_CLOCK:'+e)}},...prefixes.map(prefix=>({settingKey:{startsWith:prefix}}))]},select:{id:true,settingKey:true,value:true}});
  const referencedCustomers=[...new Set<string>(raw!.map(r=>r.settingKey.startsWith('CUSTOMER_REFERRAL:')?r.settingKey.slice(18):r.value?.customerId).filter(Boolean))];
  const referencedTickets=[...new Set<string>(raw!.map(r=>r.settingKey.startsWith('TICKET_TIPS:')?r.settingKey.slice(12):r.settingKey.startsWith('PORTAL_CANCELLATION:')?r.settingKey.slice(20):r.value?.ticketId).filter(Boolean))];
  const [visibleCustomers,tickets]=await Promise.all([referencedCustomers.length?client.customer.findMany({where:{tenantId,id:{in:referencedCustomers}},select:{id:true}}):[],referencedTickets.length?client.ticket.findMany({where:{tenantId,locationId,id:{in:referencedTickets}},select:{id:true}}):[]]);
  rows=raw!.map(r=>reportingSetting(r,new Set(visibleCustomers.map((c:any)=>c.id)),new Set(tickets.map((t:any)=>t.id)),new Set(staffIds),manager,userId,locationId)).filter(Boolean);
 }
 if(part==='audits'){
  raw=await client.auditEntry.findMany({...page,where:{tenantId,...(id?{id}:{}),action:{in:['TICKET_STOCK_SALE','CANCELLATION_REVIEW','MEMBERSHIP_RESUME','MEMBERSHIP_STATUS','CUSTOM_RULE_TASK','CUSTOM_RULE_NOTICE']},OR:[{customerId:null},{customerId:{in:customerIds}}]},select:{id:true,entityId:true,customerId:true,action:true,occurredAt:true,details:true}});
  rows=raw!.filter(a=>!a.action.startsWith('CUSTOM_RULE_')||manager||a.details?.assigneeId===userId).map(a=>({...a,details:pick(a.details,['ticketId','sold','unitCostCents','id','state','feeAppliedCents','ruleId','recordId','assigneeId','from','to','status','previousStatus'])}));
 }
 if(part==='messages')rows=await client.communication.findMany({...page,where:{tenantId,direction:'OUTBOUND',customerId:{in:customerIds},...(id?{id}:{})},select:{id:true,customerId:true,ticketId:true,createdAt:true,subject:true,channel:true,deliveryStatus:true}});
 if(['memberships','membershipRequests','membershipPayments','accountEntries'].includes(part)&&customerIds.length){
  const ids=Prisma.join(customerIds);
  if(part==='memberships')rows=await client.$queryRaw`SELECT id,name,customerId,status,startedAt,endedAt,pausedAt FROM Membership WHERE tenantId=${tenantId} AND customerId IN (${ids}) AND id>${after} ORDER BY id LIMIT 250`;
  if(part==='membershipRequests')rows=await client.$queryRaw`SELECT r.id,r.membershipId,r.requestType,r.receivedAt FROM MembershipRequest r INNER JOIN Membership m ON m.id=r.membershipId AND m.tenantId=r.tenantId WHERE r.tenantId=${tenantId} AND m.customerId IN (${ids}) AND r.id>${after} ORDER BY r.id LIMIT 250`;
  if(part==='membershipPayments')rows=await client.$queryRaw`SELECT p.id,p.amountCents,p.taxCents,p.status,p.processedAt,m.customerId,m.name FROM MembershipPayment p INNER JOIN Membership m ON m.id=p.membershipId AND m.tenantId=p.tenantId WHERE p.tenantId=${tenantId} AND m.customerId IN (${ids}) AND p.id>${after} ORDER BY p.id LIMIT 250`;
  if(part==='accountEntries')rows=await client.$queryRaw`SELECT id,customerId,entryType,amountCents,reason,ticketId,referenceId,createdAt FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND customerId IN (${ids}) AND id>${after} ORDER BY id LIMIT 250`;
 }
 if(part==='shifts'||part==='overrides'){
  const staff=await client.user.findMany({where:employeeWhere,select:{id:true,locationId:true}}),ids=staff.map((s:any)=>s.id),shops=new Map(staff.map((s:any)=>[s.id,s.locationId]));
  if(ids.length){const context=await employeeLocationContext(client,tenantId);if(part==='shifts'){rows=await client.$queryRaw`SELECT id,userId,dayOfWeek,startTime,endTime,active FROM EmployeeSchedule WHERE tenantId=${tenantId} AND userId IN (${Prisma.join(ids)}) AND active=1 AND id>${after} ORDER BY id LIMIT 250`;rows=rows.map(r=>({...r,locationId:context.shift(r.id,shops.get(r.userId) as string)}));}else {rows=await client.scheduleOverride.findMany({...page,where:{tenantId,resourceKind:'employee',resourceId:{in:ids},...(id?{id}:{})},select:{id:true,resourceId:true,date:true,startTime:true,endTime:true,dayOff:true,resourceKind:true}});rows=rows.map(r=>({...r,locationId:context.date(r.resourceId,r.date,shops.get(r.resourceId) as string)}));}}
 }
 const scanned=raw||rows;return {rows,next:scanned.length===250?String(scanned.at(-1).id):null};
}
