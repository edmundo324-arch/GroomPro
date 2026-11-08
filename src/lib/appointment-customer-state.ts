import {Prisma} from '@prisma/client';
import {groomingSummary} from './grooming-notes-rules';
import {db} from './db';
import {workflowSettings} from './workflow-settings';
import {isRequestLine,petServiceTypesKey} from './calendar-presentation';
import {pickupContacts} from './pickup-call';
export async function customerStates(tenantId:string,tickets:any[]){
 if(!tickets.length)return tickets;
 const s=await workflowSettings(tenantId),customerIds=[...new Set<string>(tickets.map(t=>t.customerId).filter(Boolean))];
 const oldest=new Date(Math.min(...tickets.map(t=>+new Date(t.scheduledStart||t.createdAt||Date.now()))));oldest.setMonth(oldest.getMonth()-s.newCustomerMonths);
 const [previous,communications,services,memberships,overrides,grooming]=await Promise.all([
  db.ticket.findMany({where:{tenantId,customerId:{in:customerIds},status:'CLOSED',scheduledStart:{gte:oldest},lines:{some:{lineType:'SERVICE',role:{in:['GROOM','BATH','PREP','DRY']}}}},select:{id:true,customerId:true,scheduledStart:true,createdAt:true,lines:{select:{role:true,description:true,serviceId:true,lineType:true}}},orderBy:{scheduledStart:'desc'}}),
  db.communication.findMany({where:{tenantId,ticketId:{in:tickets.map(t=>t.id)},direction:'OUTBOUND',deliveryStatus:{in:['SENT','DELIVERED']}},select:{ticketId:true,subject:true,sentAt:true,channel:true}}),
  db.service.findMany({where:{tenantId,id:{in:[...new Set<string>(tickets.flatMap(t=>(t.lines||[]).map((l:any)=>l.serviceId)).filter(Boolean))]}},select:{id:true,code:true,name:true,category:true,customFields:true}}),
  customerIds.length?db.$queryRaw<{customerId:string}[]>`SELECT DISTINCT customerId FROM Membership WHERE tenantId=${tenantId} AND customerId IN (${Prisma.join(customerIds)}) AND status IN ('ACTIVE','PAUSE_REQUESTED','CANCELLATION_REQUESTED')`:Promise.resolve([]),
  db.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.map(t=>petServiceTypesKey(t.id))}},select:{settingKey:true,value:true}}),
  db.groomingNote.findMany({where:{tenantId,ticketId:{in:tickets.map(t=>t.id)}},select:{ticketId:true,petId:true,instructions:true}})
 ]);
 const overridesByTicket=new Map(overrides.map(row=>[row.settingKey,row.value]));
 const groomingByPet=new Map(grooming.map(note=>[note.ticketId+':'+note.petId,note.instructions]));
 const serviceById=new Map(services.map(s=>[s.id,s]));
 return tickets.map(t=>{
  const anchor=new Date(t.scheduledStart||t.createdAt||Date.now()),cutoff=new Date(anchor);cutoff.setMonth(cutoff.getMonth()-s.newCustomerMonths);
  const visits=previous.filter(p=>p.id!==t.id&&p.customerId===t.customerId&&+new Date(p.scheduledStart||p.createdAt)<+anchor&&+new Date(p.scheduledStart||p.createdAt)>=+cutoff);
  const lines=(t.lines||[]).map((l:any)=>{const service=serviceById.get(l.serviceId);return service?{...l,service:{...l.service,...service}}:l});
  const pets=t.pets?.map((entry:any)=>({...entry,pet:{...entry.pet,todaysGroomingNotes:groomingSummary(groomingByPet.get(t.id+':'+entry.pet?.id))}}));
  return {...t,...(pets?{pets}:{}),lines,petServiceTypes:overridesByTicket.get(petServiceTypesKey(t.id))||{},hasVipMembership:memberships.some(m=>m.customerId===t.customerId),isNewCustomer:!visits.length,previousServiceType:visits[0]?.lines.some(l=>l.role==='GROOM')?'GR':'FW',hasBookedService:lines.some((l:any)=>l.lineType!=='PRODUCT'&&!isRequestLine(l)),...pickupContacts(t.id,t.pickupAt,communications)};
 });
}
