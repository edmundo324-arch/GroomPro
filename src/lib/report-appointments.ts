type Count={id:string;name:string;count:number};
export function appointmentBreakdowns(tickets:any[],employees:any[],timezone:string){
 const names=new Map(employees.map(e=>[e.id,e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' ')]));
 const groups={statuses:new Map<string,Count>(),days:new Map<string,Count>(),hours:new Map<string,Count>(),services:new Map<string,Count>(),employees:new Map<string,Count>()};
 const add=(group:Map<string,Count>,id:string,name:string)=>{const row=group.get(id)||{id,name,count:0};row.count++;group.set(id,row)};
 let invalidDates=0;
 for(const ticket of tickets){
  add(groups.statuses,ticket.status,ticket.status.replaceAll('_',' '));
  const start=new Date(ticket.scheduledStart);
  if(!ticket.scheduledStart||!Number.isFinite(+start)){invalidDates++;continue;}
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(start).map(p=>[p.type,p.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`,hour=parts.hour+':00';add(groups.days,day,day);add(groups.hours,hour,hour);
  const services=new Map<string,string>(),assigned=new Set<string>();
  for(const line of ticket.lines||[]){
   if(line.assignedUserId)assigned.add(line.assignedUserId);
   if(line.serviceId)services.set(line.serviceId,line.service?.name||line.description||'Service');
  }
  for(const [id,name] of services)add(groups.services,id,name);
  if(!assigned.size)add(groups.employees,'unassigned','Unassigned');
  for(const id of assigned)if(names.has(id))add(groups.employees,id,names.get(id)!);
 }
 return {total:tickets.length,invalidDates,...Object.fromEntries(Object.entries(groups).map(([key,value])=>[key,[...value.values()].sort((a,b)=>a.name.localeCompare(b.name))]))} as {total:number;invalidDates:number;statuses:Count[];days:Count[];hours:Count[];services:Count[];employees:Count[]};
}
