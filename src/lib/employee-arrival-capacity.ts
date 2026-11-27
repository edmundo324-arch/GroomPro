import {arrivalLimitKey,parseEmployeeArrivalLimit} from './employee-arrival-limit-settings';
import {lineSchedule,lineTimeKey,responsibleEmployee} from './pet-scheduling';
import {plannedFor,type PlannedPackage} from './planned-package-rules';
import {packageKey} from './package-display';

export type ArrivalLimit={maxAppointments:number;intervalMinutes:number};
export type ArrivalReservation={ticketId:string;employeeId:string;locationId:string;start:number;end:number};
const activeStatuses=['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY'];
const arrivalStatuses=[...activeStatuses,'CLOSED'];

function families(rows:ArrivalReservation[]){
 const result=new Map<string,ArrivalReservation>();
 for(const row of rows){
  if(!row.ticketId||!row.employeeId||!Number.isFinite(row.start)||!Number.isFinite(row.end))continue;
  const key=JSON.stringify([row.ticketId,row.employeeId,row.locationId]),existing=result.get(key);
  result.set(key,existing?{...existing,start:Math.min(existing.start,row.start),end:Math.max(existing.end,row.end)}:{...row});
 }
 return [...result.values()];
}

// An interval is rolling and half-open: an arrival exactly 30 minutes later
// starts a new allowance. Completed grooming duration is not the arrival limit.
export function createEmployeeArrivalCapacity(limits:ReadonlyMap<string,ArrivalLimit>,reservations:ArrivalReservation[]){
 const saved=families(reservations);
 function reason(candidate:ArrivalReservation,additional:ArrivalReservation[]=[]):string|null{
  if(!Number.isFinite(candidate.start)||!Number.isFinite(candidate.end)||candidate.end<=candidate.start)return 'Choose a valid appointment time.';
  const others=families([...saved,...additional]).filter(row=>row.employeeId===candidate.employeeId&&row.ticketId!==candidate.ticketId);
  if(others.some(row=>row.locationId!==candidate.locationId&&row.end>row.start&&row.start<candidate.end&&row.end>candidate.start))return 'This employee has an overlapping appointment at another location. Choose another time or employee.';
  const limit=limits.get(candidate.employeeId);if(!limit)return null;
  const interval=limit.intervalMinutes*60000;
  const arrivals=[...others.filter(row=>row.locationId===candidate.locationId&&Math.abs(row.start-candidate.start)<interval),candidate].sort((a,b)=>a.start-b.start);
  const own=arrivals.indexOf(candidate);let right=0;
  for(let left=0;left<=own;left++){
   if(right<left)right=left;
   while(right<arrivals.length&&arrivals[right].start-arrivals[left].start<interval)right++;
   if(right>own&&right-left>limit.maxAppointments)return `Employee arrival limit reached: This employee allows ${limit.maxAppointments} family ${limit.maxAppointments===1?'appointment':'appointments'} every ${limit.intervalMinutes} minutes. Choose a later time or another employee.`;
  }
  return null;
 }
 return {reservations:saved,configured:(id:string)=>limits.has(id),limit:(id:string)=>limits.get(id)||null,reason,allows:(candidate:ArrivalReservation,additional:ArrivalReservation[]=[])=>reason(candidate,additional)===null};
}

// Count one family arrival per employee. Service-line times only extend the
// occupied period used to prevent simultaneous work at different locations.
export function ticketArrivalReservations(ticket:any,plans:PlannedPackage[]=[],lineStarts:Record<string,string>={}):ArrivalReservation[]{
 if(!ticket.scheduledStart||['CANCELLED','NO_SHOW'].includes(ticket.status))return [];
 const start=+new Date(ticket.scheduledStart);if(!Number.isFinite(start))return [];
 const lines=ticket.lines||[],times=lineSchedule({...ticket,lineStarts}),users=new Map<string,number>();
 const fallback=plans.length?'':ticket.assignments?.find((a:any)=>a.role==='PLANNED_GROOMER')?.userId||ticket.assignments?.find((a:any)=>a.role==='GROOMER')?.userId||'';
 const end=start+Math.max(1,Number(ticket.durationMin)||1)*60000;
 const add=(userId:string|null|undefined,until=end)=>{if(userId)users.set(userId,Math.max(users.get(userId)||start,until))};
 for(const line of lines){
  if(line.lineType==='PRODUCT'||line.type==='PRODUCT')continue;
  const petId=line.petId||line.pet?.id||'',until=times[lineTimeKey(line)]?+new Date(times[lineTimeKey(line)])+Math.max(1,Number(line.durationMin??line.service?.durationMin)||1)*Math.max(1,Number(line.quantity)||1)*60000:end;
  add(line.assignedUserId,until);
  const responsible=responsibleEmployee(lines,petId)?.assignedUserId;
  add(responsible||plannedFor(lines,plans,petId,packageKey(line),fallback),until);
 }
 for(const plan of plans){if(!lines.some((line:any)=>(line.petId||line.pet?.id)===plan.petId))add(plan.userId)}
 if(!lines.length&&!plans.length)for(const assignment of ticket.assignments||[])add(assignment.userId);
 const closed=ticket.status==='CLOSED'&&ticket.closedAt?+new Date(ticket.closedAt):NaN;
 return [...users].map(([employeeId,until])=>({ticketId:ticket.id,employeeId,locationId:ticket.locationId,start,end:ticket.status==='CLOSED'?Math.max(start,Math.min(until,Number.isFinite(closed)?closed:start)):until}));
}

async function ticketSettings(client:any,tenantId:string,tickets:any[]){
 if(!tickets.length)return new Map<string,any>();
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.flatMap(t=>['TICKET_PLANNED_PACKAGES:'+t.id,'TICKET_LINE_STARTS:'+t.id])}},select:{settingKey:true,value:true}});
 return new Map<string,any>(rows.map((row:any)=>[row.settingKey,row.value]));
}
function reservationsFrom(tickets:any[],settings:Map<string,any>){return tickets.flatMap(ticket=>ticketArrivalReservations(ticket,settings.get('TICKET_PLANNED_PACKAGES:'+ticket.id)?.items||[],settings.get('TICKET_LINE_STARTS:'+ticket.id)||{}))}

export async function loadEmployeeArrivalCapacity(client:any,tenantId:string,employeeIds:string[],from:Date,to:Date,options:{lock?:boolean;excludeTicketId?:string}={}){
 const ids=[...new Set(employeeIds.filter(Boolean))];
 if(!Number.isFinite(+from)||!Number.isFinite(+to)||+to<=+from)throw Error('Choose a valid appointment time.');
 if(options.lock)await client.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 if(!ids.length)return createEmployeeArrivalCapacity(new Map(),[]);
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:ids.map(arrivalLimitKey)}},select:{settingKey:true,value:true}}),limits=new Map<string,ArrivalLimit>();
 for(const id of ids){const row=rows.find((entry:any)=>entry.settingKey===arrivalLimitKey(id));const limit=parseEmployeeArrivalLimit(row?.value);if(limit)limits.set(id,limit)}
 const margin=Math.max(0,...[...limits.values()].map(limit=>limit.intervalMinutes))*60000,lower=new Date(+from-margin),upper=new Date(+to+margin);
 const relevant=await client.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND status IN ('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED') AND scheduledStart<${upper} AND (scheduledStart>=${lower} OR DATE_ADD(scheduledStart,INTERVAL durationMin MINUTE)>${lower})`;
 const ticketIds=(relevant as {id:string}[]).map(row=>row.id).filter(id=>id!==options.excludeTicketId);
 const tickets=ticketIds.length?await client.ticket.findMany({where:{tenantId,id:{in:ticketIds},status:{in:arrivalStatuses}},include:{lines:{include:{service:{select:{durationMin:true}}}},assignments:true}}):[];
 const settings=await ticketSettings(client,tenantId,tickets),wanted=new Set(ids);
 return createEmployeeArrivalCapacity(limits,reservationsFrom(tickets,settings).filter(row=>wanted.has(row.employeeId)));
}

export async function readTicketArrivalReservations(client:any,tenantId:string,ticketId:string):Promise<ArrivalReservation[]>{
 const ticket=await client.ticket.findFirst({where:{id:ticketId,tenantId,status:{in:activeStatuses}},include:{lines:{include:{service:{select:{durationMin:true}}}},assignments:true}});
 if(!ticket?.scheduledStart||!activeStatuses.includes(ticket.status))return [];
 return reservationsFrom([ticket],await ticketSettings(client,tenantId,[ticket]));
}

// Call after a planning mutation inside its transaction, before committing.
// Actual-work attribution and appearance/reconciliation do not call this guard.
export async function ticketArrivalLimitError(client:any,tenantId:string,ticketId:string,previous?:ArrivalReservation[]):Promise<string|null>{
 const unchanged=(candidate:ArrivalReservation)=>previous?.find(row=>row.employeeId===candidate.employeeId&&row.locationId===candidate.locationId&&row.start===candidate.start);
 const candidates=(await readTicketArrivalReservations(client,tenantId,ticketId)).filter(candidate=>{const before=unchanged(candidate);return !before||candidate.end>before.end});
 if(!candidates.length)return null;
 const from=new Date(Math.min(...candidates.map(row=>row.start))),to=new Date(Math.max(...candidates.map(row=>row.end)));
 const capacity=await loadEmployeeArrivalCapacity(client,tenantId,candidates.map(row=>row.employeeId),from,to,{excludeTicketId:ticketId});
 const occupied=createEmployeeArrivalCapacity(new Map(),capacity.reservations);
 for(const candidate of candidates){if(!capacity.configured(candidate.employeeId))continue;const reason=unchanged(candidate)?occupied.reason(candidate):capacity.reason(candidate);if(reason)return reason}
 return null;
}
