import {productivityRows} from './report-calculations';
export {productivityRows} from './report-calculations';
import {db} from './db';
import {Prisma} from '@prisma/client';
import {employeeReport} from './employee-report';
import {employeeLocationContext} from './employee-shift-location';
import {productivityPeriods,productivityScheduledMinutes} from './productivity-periods';
import {zonedParts} from './operating-hours';

export async function productivityReport(tenantId:string,location:{id:string;timezone:string},employees:any[],clocks:any,start:Date,end:Date,asOf:Date){
 const periods=productivityPeriods(start,end,asOf,location.timezone),ids=employees.map(e=>e.id);
 const tickets=await db.ticket.findMany({where:{tenantId,locationId:location.id,scheduledStart:{gte:start,lt:end},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED']}},select:{id:true,scheduledStart:true,status:true,bookingDecision:true,lines:{select:{id:true,lineType:true,durationMin:true,quantity:true,assignedUserId:true}}}});
 let past=null,planned=null;
 if(periods.past){const p=periods.past,work=employeeReport(employees,[],clocks,location.id,p.start,p.end,asOf);past={...productivityRows(employees,tickets,work.rows.map(r=>({userId:r.id,minutes:r.minutesExcludingBreaks})),p.start,p.end,true),invalidTimeRecords:work.invalidRecords};}
 if(periods.planned){const p=periods.planned;let availability:any[]=[];if(ids.length){
 const [shifts,overrides,assigned,context]=await Promise.all([db.$queryRaw<any[]>`SELECT id,userId,dayOfWeek,startTime,endTime,active FROM EmployeeSchedule WHERE tenantId=${tenantId} AND userId IN (${Prisma.join(ids)}) AND active=1`,db.scheduleOverride.findMany({where:{tenantId,resourceKind:'employee',resourceId:{in:ids},date:{gte:zonedParts(p.start,location.timezone).date,lte:zonedParts(new Date(+p.end-1),location.timezone).date}}}),db.user.findMany({where:{tenantId,id:{in:ids}},select:{id:true,locationId:true}}),employeeLocationContext(db,tenantId)]);
 const shops=new Map(assigned.map(e=>[e.id,e.locationId]));availability=productivityScheduledMinutes(employees,shifts.map(s=>({...s,locationId:context.shift(s.id,shops.get(s.userId))})),overrides.map(o=>({...o,locationId:context.date(o.resourceId,o.date,shops.get(o.resourceId))})),location.id,p.start,p.end,location.timezone);
 }planned=productivityRows(employees,tickets,availability,p.start,p.end,false);}
 return {asOf:asOf.toISOString(),past,planned};
}
