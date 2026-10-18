import {nextTicketNumber} from '../ticket-number';
import {ticketDuration} from '../ticket-timing';
export const appointmentInclude={pets:true,lines:{orderBy:{sortOrder:'asc'}},assignments:true,scheduleHistory:true,payments:true} as const;
// Resolve only tenant-scoped records already loaded by the migration planner.
export function appointmentData(data:any,locationId:string|undefined,resolve:(entity:string,id:string)=>any){
 if(!locationId)throw Error('Select a location before importing appointments.');
 if(!data.customerId||!data.scheduledStart)throw Error('Appointment customer and scheduled date/time are required.');
 const mode=data.timingMode||'SEQUENTIAL';if(!['SEQUENTIAL','CONCURRENT'].includes(mode))throw Error('Invalid appointment timing mode.');
 const status=data.status||'OPEN';if(!['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','NO_SHOW','CANCELLED','CLOSED'].includes(status))throw Error('Invalid appointment status.');
 const petIds=[...new Set<string>([...(data.petIds||[]).map((id:any)=>{const pet=resolve('PET',String(id));if(!pet)throw Error('Pet identifier cannot be resolved.');return pet.id}),...(data.petId?[data.petId]:[])])];
 for(const id of petIds){const pet=resolve('PET',id);if(!pet||pet.customerId!==data.customerId)throw Error('Appointment pet does not belong to its customer.');}
 const inputs=data.lines||[{description:data.description,serviceId:data.serviceSourceId,unitPriceCents:data.priceCents||0,durationMin:data.durationMin||0,petId:petIds[0]}];
 if(!inputs.length)throw Error('Appointment needs booked service details.');
 const integer=(value:any,label:string,minimum=0)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<minimum||n>2147483647)throw Error('Invalid '+label+'.');return n};
 const lines=inputs.map((line:any,index:number)=>{
  if(!line||typeof line!=='object')throw Error('Invalid booked line item.');
  const service=line.serviceId?resolve('SERVICE',String(line.serviceId)):null;
  // A booked description is operational without creating or importing a service catalog.
  const description=String(line.description||service?.name||'').trim();if(!description||description.length>191)throw Error('Each booked item needs a description of up to 191 characters.');
  const petId=line.petId?resolve('PET',String(line.petId))?.id:petIds.length===1?petIds[0]:null;
  if(!petId||!petIds.includes(petId))throw Error('Each booked service must identify a pet on this appointment.');
  const employee=line.employeeId?resolve('EMPLOYEE',String(line.employeeId)):null;if(line.employeeId&&!employee)throw Error('Service employee identifier cannot be resolved.');
  const role=line.role||'GROOM';if(!['PREP','BATH','GROOM','ADD_ON'].includes(role))throw Error('Invalid booked service role.');
  const quantity=integer(line.quantity??1,'quantity',1),unitPriceCents=integer(line.unitPriceCents??service?.priceCents??0,'price'),discountCents=integer(line.discountCents??0,'discount');
  const totalCents=quantity*unitPriceCents-discountCents;integer(totalCents,'line total');
  return {lineType:'SERVICE',role,description,petId,serviceId:service?.id||null,assignedUserId:employee?.id||null,quantity,unitPriceCents,discountCents,totalCents,durationMin:integer(line.durationMin??service?.durationMin??data.durationMin??0,'service duration'),sortOrder:index};
 });
 const durationMin=data.durationMin===undefined?ticketDuration(lines,mode):integer(data.durationMin,'appointment duration',1);
 if(durationMin<1)throw Error('Appointment duration must be positive.');
 return {locationId,customerId:data.customerId,scheduledStart:data.scheduledStart,durationMin,timingMode:mode,status,notes:data.notes||null,totalCents:integer(lines.reduce((n:number,l:any)=>n+l.totalCents,0),'appointment total'),pets:{create:petIds.map(petId=>({petId}))},lines:{create:lines},...(data.employeeId?{assignments:{create:[{userId:data.employeeId,role:'GROOMER'},{userId:data.employeeId,role:'PLANNED_GROOMER'}]}}:{})};
}
export async function insertAppointment(tx:any,tenantId:string,id:string,data:any){
 const orderNumber=await nextTicketNumber(tx,tenantId);
 const ticket=await tx.ticket.create({data:{...data,id,tenantId,orderNumber}});
 await tx.ticketScheduleHistory.create({data:{tenantId,ticketId:id,changeType:'CREATED',newStart:data.scheduledStart}});
 return ticket;
}
