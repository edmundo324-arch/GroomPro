import {db} from './db';
import {readRebookingDiscountPolicy} from './rebooking-discount-policy';
import {mainRebookingLineIds,rebookingPercent} from './rebooking-discount-rules';
import {petSchedule} from './pet-scheduling';
import {zonedParts} from './operating-hours';
export async function refreshRebookingDiscounts(tx:any,tenantId:string,ticketId:string,actor:string|null=null,overrideStart?:Date){
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},include:{lines:{include:{service:true},orderBy:{sortOrder:'asc'}},location:true,payments:true,scheduleHistory:{orderBy:{changedAt:'asc'}}}});
 if(!ticket||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status)||!ticket.scheduledStart)return {changed:0};
 const timezone=ticket.location.timezone,settingKey='REBOOKING_DISCOUNT:'+ticketId,where={tenantId_settingKey:{tenantId,settingKey}};
 const saved=(await tx.tenantSetting.findUnique({where}))?.value as any;
 if(saved?.managerOverride===true)return {changed:0};
 const starts=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_LINE_STARTS:'+ticketId}}}))?.value||{};
 const types=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_PET_SERVICE_TYPES:'+ticketId}}}))?.value||{};
 const live={...ticket,scheduledStart:overrideStart||ticket.scheduledStart,lineStarts:starts,petServiceTypes:types};
 const eligible=mainRebookingLineIds(live),{policy}=await readRebookingDiscountPolicy(tenantId,tx),originalDates={...(saved?.originalDates||{})},removed=new Set<string>(saved?.advanceRemovedPets||[]),percentByPet=new Map<string,number>();
 const petIds=[...new Set<string>(ticket.lines.map((l:any)=>l.petId).filter(Boolean))];
 for(const petId of petIds){
  const target=petSchedule(live,petId).start,day=zonedParts(target,timezone).date;
  if(!originalDates[petId])originalDates[petId]=zonedParts(petSchedule({...ticket,lineStarts:starts},petId).start,timezone).date;
  if(day!==originalDates[petId])removed.add(petId);
  const earliest=new Date(target);earliest.setUTCDate(earliest.getUTCDate()-50);
  const previous=await tx.ticket.findMany({where:{tenantId,id:{not:ticketId},scheduledStart:{gte:earliest,lte:target},OR:[{status:'CLOSED'},{checkedInAt:{not:null},status:{notIn:['CANCELLED','NO_SHOW']}}],pets:{some:{petId}}},include:{lines:{include:{service:true},orderBy:{sortOrder:'asc'}}},orderBy:{scheduledStart:'desc'}});
  const candidates:any[]=[];
  for(const prior of previous){
   const priorStarts=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_LINE_STARTS:'+prior.id}}}))?.value||{};
   const priorTypes=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_PET_SERVICE_TYPES:'+prior.id}}}))?.value||{};
   const qualified={...prior,lineStarts:priorStarts,petServiceTypes:priorTypes};
   if([...mainRebookingLineIds(qualified)].some(id=>prior.lines.some((l:any)=>l.id===id&&l.petId===petId))){const visitStart=petSchedule(qualified,petId).start;if(+visitStart<=+target)candidates.push({...prior,scheduledStart:visitStart});}
  }
  const source=candidates.sort((a,b)=>+b.scheduledStart-+a.scheduledStart)[0];
  percentByPet.set(petId,source?rebookingPercent(source,target,new Date(ticket.scheduleHistory.find((h:any)=>h.changeType==='CREATED')?.changedAt||ticket.createdAt),timezone,policy,!removed.has(petId)&&ticket.bookingSource!=='IMPORT'):0);
 }
 const changes:any[]=[],records:any[]=[];
 for(const line of ticket.lines){const old=saved?.lines?.find((v:any)=>v.lineId===line.id),percent=eligible.has(line.id)?percentByPet.get(line.petId)||0:0;
  if(!old&&!percent)continue;
  const base=old&&line.discountCents===old.appliedDiscountCents?old.baseDiscountCents:line.discountCents,gross=line.unitPriceCents*line.quantity,discountCents=Math.max(base,Math.round(gross*percent/100));
  if(discountCents!==line.discountCents){if(line.totalCents!==Math.max(0,gross-line.discountCents))throw Error('Review the saved item price before applying the return-visit discount.');changes.push({lineId:line.id,discountCents,totalCents:Math.max(0,gross-discountCents),commissionCents:Math.round(Math.max(0,gross-discountCents)*Number(line.commissionPct||0)/100),previousDiscountCents:line.discountCents});}
  records.push({lineId:line.id,baseDiscountCents:base,appliedDiscountCents:discountCents,percent});
 }
 const totalCents=ticket.lines.reduce((sum:number,l:any)=>sum+(changes.find(c=>c.lineId===l.id)?.totalCents??l.totalCents),0)+ticket.salesTaxCents+ticket.tipCents;
 const paid=ticket.payments.reduce((sum:number,p:any)=>sum+Math.round(Number(p.amount)*100),0);
 if(changes.length&&totalCents<paid)throw Error('The return-visit discount would reduce this ticket below payments already recorded. Review the payments before continuing.');
 for(const change of changes){const {lineId,previousDiscountCents,...data}=change;await tx.ticketLine.update({where:{id:lineId},data});}
 if(changes.length)await tx.ticket.update({where:{id:ticketId},data:{totalCents}});
 const value={originalDates,advanceRemovedPets:[...removed],lines:records};
 if(JSON.stringify(value)!==JSON.stringify(saved))await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
 if(changes.length)await tx.auditEntry.create({data:{tenantId,actorType:actor?'EMPLOYEE':'SYSTEM',...(actor?{actorUserId:actor}:{}),entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'REBOOKING_DISCOUNT',summary:'Updated return-visit and advance-booking discounts for eligible grooming services.',details:{changes,advanceRemovedPets:[...removed]}}});
 return {changed:changes.length,percentByPet:Object.fromEntries(percentByPet)};
}
export async function updateRebookingDiscounts(tenantId:string,ticketId:string,actor:string|null=null){return db.$transaction(tx=>refreshRebookingDiscounts(tx,tenantId,ticketId,actor));}
