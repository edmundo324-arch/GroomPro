import {randomUUID} from 'node:crypto';
import {catalogSyncTicketAllowed,changedCatalogLine,emptyCatalogSync,normalizeCatalogTicketPackages,planCatalogTicketUpdate,type CatalogChange,type CatalogSyncScope} from './catalog-sync';
import {groomingEligibility} from './breed-classification';
import {loadBreeds} from './breed-store';
import {approvalMatches} from './calendar-assignment-approval';
import {lineSchedule,lineTimeKey,petSchedule} from './pet-scheduling';
import {readLineStarts,writeLineStarts} from './line-time-store';
import {ticketDuration} from './ticket-timing';
import {ticketWorkspace} from './pos-layout';
import {defaultTicketTax} from './dog-ticket-summary';
import {refreshRebookingDiscounts} from './rebooking-discount-store';

export async function catalogRecord(tx:any,tenantId:string,kind:string,id:string){
 if(kind==='services')return tx.service.findFirst({where:{tenantId,id}});
 if(kind==='packages')return tx.package.findFirst({where:{tenantId,id},include:{items:{orderBy:{sortOrder:'asc'}}}});
 if(kind==='plans')return (await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'VIP_PLAN:'+id}}}))?.value||null;
 return null;
}

// Older lines without snapshots used the live service as a fallback. Fill only
// missing snapshots before editing that service so None and paid history keep
// their existing effective duration/wording. Prices and ticket dates never change.
export async function retainLegacyServiceSnapshots(tx:any,tenantId:string,before:any,after:any){
 if(before.durationMin!==after.durationMin)await tx.ticketLine.updateMany({where:{serviceId:before.id,durationMin:null,ticket:{tenantId}},data:{durationMin:before.durationMin}});
 if(before.description!==after.description)await tx.ticketLine.updateMany({where:{serviceId:before.id,reportCardDescription:null,ticket:{tenantId}},data:{reportCardDescription:before.description||''}});
}

type SyncDependencies={now?:Date;available?:(tenantId:string,userId:string,locationId:string,start:Date,duration:number)=>Promise<boolean>;discounts?:typeof refreshRebookingDiscounts};
export async function syncCatalogAppointments(tx:any,tenantId:string,actorId:string,change:CatalogChange,scope:CatalogSyncScope,deps:SyncDependencies={}){
 const summary=emptyCatalogSync();if(scope==='NONE')return summary;
 if(change.kind==='plans')throw Error('Existing VIP membership terms must be selected separately.');
 const before=change.before,after=change.after,now=deps.now||new Date();
 const where={tenantId,...(change.locationId?{locationId:change.locationId}:{}),status:{notIn:['CLOSED','CANCELLED','NO_SHOW']},closedAt:null,lines:{some:change.kind==='services'?{serviceId:before.id}:{OR:[{packageId:before.id},{packageId:null,OR:[{packageName:before.name},{description:{startsWith:before.name+' · '}}]}]}}};
 const candidates=await tx.ticket.findMany({where,select:{id:true},orderBy:{id:'asc'}});
 const settings=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'WORKFLOW'}}}))?.value||{},policy=ticketWorkspace(settings.posLayout);
 if(change.kind==='packages')change.services=await tx.service.findMany({where:{tenantId,id:{in:[...new Set([...before.items,...after.items].map((i:any)=>i.serviceId))]}}});
 const packageCatalog=await tx.package.findMany({where:{tenantId},include:{items:{include:{service:true},orderBy:{sortOrder:'asc'}}}});
 change.packages=packageCatalog.map((pkg:any)=>{
  const previous=change.kind==='packages'&&pkg.id===before.id?before:pkg;
  return {...previous,items:previous.items.map((item:any)=>({...item,service:change.kind==='services'&&item.serviceId===before.id?before:item.service||change.services?.find(service=>service.id===item.serviceId)||pkg.items.find((saved:any)=>saved.serviceId===item.serviceId)?.service}))};
 });
 change.locationPricing??=await tx[change.kind==='services'?'locationServicePricing':'locationPackagePricing'].findMany({where:{tenantId,[change.kind==='services'?'serviceId':'packageId']:before.id,active:true}});
 const breeds=change.kind==='packages'?await loadBreeds(tx,tenantId):[];
 const available=deps.available||((...args:Parameters<NonNullable<SyncDependencies['available']>>)=>import('./groomer-assignment').then(m=>m.employeeAvailable(...args)));
 for(const candidate of candidates){
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${candidate.id} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:candidate.id,tenantId},include:{payments:true,location:true,pets:{include:{pet:true}},lines:{include:{service:true,product:true},orderBy:{sortOrder:'asc'}},assignments:true}});
  if(!ticket||!catalogSyncTicketAllowed(ticket,scope,now)){summary.unchanged++;continue;}
  const rebooking=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'REBOOKING_DISCOUNT:'+ticket.id}}}))?.value;
  const starts=await readLineStarts(tx,tenantId,ticket.id);
  // Use recorded base discounts for recalculation, never treat an automatic
  // return-visit discount as an additional staff discount on top of itself.
  const baseline={...ticket,lineStarts:starts,lines:ticket.lines.map((line:any)=>{
   const saved=rebooking?.managerOverride!==true&&rebooking?.lines?.find((v:any)=>v.lineId===line.id&&v.appliedDiscountCents===line.discountCents);
   return saved?{...line,discountCents:saved.baseDiscountCents,totalCents:line.unitPriceCents*line.quantity-saved.baseDiscountCents}:line;
  })};
  let plan:ReturnType<typeof planCatalogTicketUpdate>,next:any,times:Record<string,string>,durationMin:number;
  try{
   const eligibilityChanged=['minimumWeightLbs','maximumWeightLbs','groomingRules'].some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
   const identified=normalizeCatalogTicketPackages(baseline,change);
   if(change.kind==='packages'&&eligibilityChanged)for(const petId of new Set(identified.lines.filter((l:any)=>l.packageId===before.id).map((l:any)=>l.petId))){
    const pet=ticket.pets.find((p:any)=>p.petId===petId)?.pet;
    const result=pet&&groomingEligibility(pet,after,breeds);
    if(!result||result.status!=='eligible')throw Error('The revised package needs an eligibility review for this dog.');
   }
   plan=planCatalogTicketUpdate(baseline,change);
   if(!plan.changed){summary.unchanged++;if(plan.notes.length)summary.review.push({ticketId:ticket.id,orderNumber:ticket.orderNumber,reason:plan.notes.join(' ')});continue;}
   plan.lines=plan.lines.map((line:any)=>{
    const original=ticket.lines.find((l:any)=>l.id===line.id),base=baseline.lines.find((l:any)=>l.id===line.id);
    return original&&base&&!changedCatalogLine(base,line)?original:{...line,id:line.id||randomUUID()};
   });
   const originalTimes=lineSchedule({...ticket,lineStarts:starts}),kept=Object.fromEntries(Object.entries(originalTimes).filter(([id])=>plan.lines.some((l:any)=>lineTimeKey(l)===id)));
   next={...ticket,lines:plan.lines,lineStarts:kept};times=lineSchedule(next);next.lineStarts=times;
   const ends=next.lines.filter((l:any)=>times[lineTimeKey(l)]).map((l:any)=>+new Date(times[lineTimeKey(l)])+Number(l.durationMin??l.service?.durationMin??0)*l.quantity*60000);
   durationMin=ticket.scheduledStart&&ends.length?Math.max(15,Math.ceil((Math.max(...ends)-+new Date(ticket.scheduledStart))/60000)):ticketDuration(next.lines,ticket.timingMode);
   if(ticket.bookingAssetId&&ticket.scheduledStart&&durationMin!==ticket.durationMin)throw Error('The revised duration needs a reserved-resource availability review. Existing appointment times and the reserved resource were kept.');
   const plans=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_PLANNED_PACKAGES:'+ticket.id}}}))?.value?.items||[];
   for(const petId of new Set<string>(ticket.lines.map((l:any)=>l.petId).filter(Boolean))){
    if(!ticket.scheduledStart)continue;
    const prior=petSchedule({...ticket,lineStarts:starts},petId),period=petSchedule(next,petId);
    if(+prior.start===+period.start&&prior.durationMin===period.durationMin)continue;
    const dogPlans=plans.filter((p:any)=>p.petId===petId);
    if(dogPlans.some((p:any)=>approvalMatches({...ticket,lineStarts:starts},p)&&!approvalMatches(next,p)))throw Error('This change would alter an approved scheduling exception. Review the appointment’s timing in POS.');
    const users=new Set<string>([...dogPlans.map((p:any)=>p.userId),...ticket.lines.filter((l:any)=>l.petId===petId).map((l:any)=>l.assignedUserId),...(plans.length?[]:ticket.assignments.filter((a:any)=>['GROOMER','PLANNED_GROOMER'].includes(a.role)).map((a:any)=>a.userId))].filter(Boolean));
    for(const userId of users)if(!await available(tenantId,userId,ticket.locationId,period.start,period.durationMin))throw Error('The revised duration needs a staff-availability review. Existing times and employees were kept.');
   }
  }catch(error){summary.review.push({ticketId:ticket.id,orderNumber:ticket.orderNumber,reason:error instanceof Error?error.message:'Review this appointment in POS.'});summary.unchanged++;continue;}
  // Validation above is read-only. Database failures below abort the catalog
  // save and all updates together rather than silently accepting partial work.
  const nextIds=new Set(next.lines.map((l:any)=>l.id)),removed=ticket.lines.filter((l:any)=>!nextIds.has(l.id));
  if(removed.length)await tx.ticketLine.deleteMany({where:{ticketId:ticket.id,id:{in:removed.map((l:any)=>l.id)}}});
  const changes:any[]=[];
  for(const line of next.lines){
   const previous=ticket.lines.find((l:any)=>l.id===line.id);
   if(previous&&!changedCatalogLine(previous,line))continue;
   const data=Object.fromEntries(['description','reportCardDescription','packageId','packageGroupKey','packageName','durationMin','role','quantity','unitPriceCents','discountCents','totalCents','commissionCents','sortOrder'].filter(k=>line[k]!==undefined).map(k=>[k,line[k]]));
   if(previous)await tx.ticketLine.update({where:{id:line.id},data});
   else await tx.ticketLine.create({data:{...data,id:line.id,ticketId:ticket.id,lineType:line.lineType,serviceId:line.serviceId,petId:line.petId,packageId:line.packageId,packageGroupKey:line.packageGroupKey,commissionPct:line.commissionPct,assignedUserId:null}});
   changes.push({lineId:line.id,before:previous?{description:previous.description,unitPriceCents:previous.unitPriceCents,discountCents:previous.discountCents,totalCents:previous.totalCents,durationMin:previous.durationMin}:null,after:data});
  }
  if(JSON.stringify(times)!==JSON.stringify(lineSchedule({...ticket,lineStarts:starts})))await writeLineStarts(tx,tenantId,ticket.id,times,ticket);
  // Materialize original starts when durations/content changed, keeping every
  // existing dog's drop-off and intentional per-service time in place.
  else if(ticket.lines.length!==next.lines.length||ticket.lines.some((l:any)=>{const line=next.lines.find((n:any)=>n.id===l.id);return !line||line.durationMin!==l.durationMin||line.quantity!==l.quantity||line.sortOrder!==l.sortOrder;}))await writeLineStarts(tx,tenantId,ticket.id,times,ticket);
  await (deps.discounts||refreshRebookingDiscounts)(tx,tenantId,ticket.id,actorId);
  const finalLines=await tx.ticketLine.findMany({where:{ticketId:ticket.id},include:{service:true,product:true}});
  const expectedOldTax=defaultTicketTax(ticket.lines,policy.taxRatePct),recalculateTax=policy.automaticNewTicketTax&&ticket.salesTaxCents===expectedOldTax;
  const salesTaxCents=recalculateTax?defaultTicketTax(finalLines,policy.taxRatePct):ticket.salesTaxCents;
  const totalCents=finalLines.reduce((n:number,l:any)=>n+l.totalCents,0)+salesTaxCents+ticket.tipCents;
  if(!Number.isSafeInteger(totalCents)||totalCents<0||totalCents>2147483647)throw Error('An updated appointment total is too large. No catalog changes were saved.');
  const displayKey='PROMOTION_DISPLAY:'+ticket.id;
  const display=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:displayKey}}}))?.value;
  if(Array.isArray(display)){
   const value=display.map(group=>({...group,allocations:(group.allocations||[]).map((allocation:any)=>{
    const original=ticket.lines.find((l:any)=>l.id===allocation.lineId),line=finalLines.find((l:any)=>l.id===allocation.lineId);
    const wasCurrent=original&&['discountCents','unitPriceCents','quantity','totalCents'].every(field=>original[field]===allocation[field]);
    return wasCurrent&&line&&line.discountCents===allocation.discountCents?{...allocation,unitPriceCents:line.unitPriceCents,quantity:line.quantity,totalCents:line.totalCents}:allocation;
   })}));
   if(JSON.stringify(value)!==JSON.stringify(display))await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:displayKey}},data:{value}});
  }
  await tx.ticket.update({where:{id:ticket.id},data:{durationMin,salesTaxCents,totalCents}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'CATALOG_APPOINTMENT_SYNC',summary:`Applied ${after.name} changes to this unpaid appointment.`,details:{kind:change.kind,itemId:before.id,scope,changes,removedLineIds:removed.map((l:any)=>l.id),preserved:plan.notes}}});
  summary.updated++;summary.ticketIds.push(ticket.id);
  if(plan.notes.length)summary.review.push({ticketId:ticket.id,orderNumber:ticket.orderNumber,reason:plan.notes.join(' ')});
 }
 return summary;
}
