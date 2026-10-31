import {ticketDuration,TimingMode} from './ticket-timing';
// Called inside the workflow transaction: business timing and open tickets commit together.
export async function applyBusinessTiming(tx:any,tenantId:string,mode:TimingMode){
 await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND status NOT IN ('CLOSED','CANCELLED','NO_SHOW') FOR UPDATE`;
 const tickets=await tx.ticket.findMany({where:{tenantId,status:{notIn:['CLOSED','CANCELLED','NO_SHOW']}},select:{id:true,timingMode:true,durationMin:true,lines:{select:{durationMin:true,quantity:true,lineType:true,service:{select:{durationMin:true}}}}}});
 let changed=0;
 for(const t of tickets){const durationMin=ticketDuration(t.lines,mode);if(t.timingMode!==mode||t.durationMin!==durationMin){await tx.ticket.update({where:{id:t.id},data:{timingMode:mode,durationMin}});changed++;}}
 const drafts=await tx.posDraft.findMany({where:{tenantId,promotedAt:null},select:{id:true,payload:true}});
 for(const d of drafts){const payload=d.payload as any;if(payload?.ticket&&payload.ticket.timingMode!==mode)await tx.posDraft.update({where:{id:d.id},data:{payload:{...payload,ticket:{...payload.ticket,timingMode:mode}}}});}
 return changed;
}
