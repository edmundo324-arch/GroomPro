import {offerTodayLine,offerTodaySourceKey} from './service-promotion';
import {resolveSaleLines} from './pos-lines';
import {ticketDuration} from './ticket-timing';

// Caller holds the existing ticket row lock. Desired state makes retries idempotent.
export async function setOfferTodayLine(tx:any,tenantId:string,ticketId:string,input:{id:string;petId:string;present:boolean;role?:string},checkSchedule:(ticket:any,duration:number)=>Promise<void>){
 const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{lines:{include:{service:true}},pets:true}});
 if(!ticket||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This ticket is closed or unavailable.');
 if(!ticket.pets.some((pet:any)=>pet.petId===input.petId))throw Error('The selected dog is not on this ticket.');
 const existing=offerTodayLine(ticket.lines,input.id,input.petId);
 if(input.present===!!existing)return {changed:false,line:existing||null,removed:false,removedLines:[]};
 if(!input.present){
  const removedLines=ticket.lines.filter((line:any)=>line.petId===input.petId&&!line.packageId&&line.serviceId===input.id&&line.sourceKey===offerTodaySourceKey(input.id));
  await tx.ticketLine.deleteMany({where:{ticketId,petId:input.petId,serviceId:input.id,packageId:null,sourceKey:offerTodaySourceKey(input.id)}});
  const remaining=ticket.lines.filter((line:any)=>!removedLines.some((removed:any)=>removed.id===line.id));
  await tx.ticket.update({where:{id:ticketId},data:{durationMin:ticketDuration(remaining,ticket.timingMode)}});
  return {changed:true,line:existing,removed:true,removedLines};
 }
 const result=await resolveSaleLines(tx,tenantId,[{type:'SERVICE',id:input.id,petId:input.petId,quantity:1,role:input.role,offerToday:true}],ticket.pets.map((pet:any)=>pet.petId),ticket.locationId);
 const durationMin=ticketDuration([...ticket.lines,...result.lines],ticket.timingMode);
 await checkSchedule(ticket,durationMin);
 const line=await tx.ticketLine.create({data:{...result.lines[0],ticketId,sortOrder:Math.max(-1,...ticket.lines.map((line:any)=>line.sortOrder))+1}});
 await tx.ticket.update({where:{id:ticketId},data:{durationMin}});
 return {changed:true,line,removed:false,removedLines:[]};
}
