import type {ClockState} from './time-clock';

export type EmployeeReportRow={id:string;name:string;commissionCents:number;tipCents:number;elapsedMinutes:number;breakMinutes:number;minutesExcludingBreaks:number;openShifts:number};
// Attendance is clipped to the requested period and the shift's recorded location.
// Never infer grooming duration, paid breaks, wages or overtime from these records.
export function employeeReport(employees:{id:string;firstName:string;lastName:string;displayName?:string|null}[],closed:any[],clocks:Map<string,ClockState>,locationId:string,start:Date,end:Date,asOf:Date,allocations:Map<string,{shares?:{userId:string;amountCents:number}[]}>=new Map()){
 const rows=new Map<string,EmployeeReportRow>(employees.map(e=>[e.id,{id:e.id,name:e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' '),commissionCents:0,tipCents:0,elapsedMinutes:0,breakMinutes:0,minutesExcludingBreaks:0,openShifts:0}]));
 let invalidRecords=0,unallocatedTipCents=0;
 for(const ticket of closed){let assigned=0;for(const share of allocations.get(ticket.id)?.shares||[]){if(!Number.isSafeInteger(share.amountCents)||share.amountCents<0){invalidRecords++;continue;}assigned+=share.amountCents;const row=rows.get(share.userId);if(row)row.tipCents+=share.amountCents;}unallocatedTipCents+=(ticket.tipCents||0)-assigned;}
 for(const ticket of closed)for(const line of ticket.lines||[]){const row=rows.get(line.assignedUserId);if(row)row.commissionCents+=line.commissionCents||0;}
 for(const [id,state] of clocks){
  const row=rows.get(id);if(!row)continue;
  for(const shift of state.shifts||[]){
   if(shift.locationId!==locationId)continue;
   const originalStart=+new Date(shift.start),originalEnd=shift.end?+new Date(shift.end):+asOf;
   if(!Number.isFinite(originalStart)||!Number.isFinite(originalEnd)||originalEnd<originalStart){invalidRecords++;continue;}
   const a=Math.max(originalStart,+start),b=Math.min(originalEnd,+end,+asOf);if(b<=a)continue;
   const intervals:number[][]=[];
   for(const pause of shift.breaks||[]){const x=+new Date(pause.start),y=pause.end?+new Date(pause.end):originalEnd;if(!Number.isFinite(x)||!Number.isFinite(y)||y<x){invalidRecords++;continue;}const left=Math.max(a,x),right=Math.min(b,y);if(right>left)intervals.push([left,right]);}
   // Union intervals avoids double-subtracting overlapping legacy break records.
   intervals.sort((x,y)=>x[0]-y[0]);let breakMs=0,lastEnd=a;
   for(const [left,right] of intervals){breakMs+=Math.max(0,right-Math.max(left,lastEnd));lastEnd=Math.max(lastEnd,right);}
   row.elapsedMinutes+=(b-a)/60000;row.breakMinutes+=breakMs/60000;row.minutesExcludingBreaks+=(b-a-breakMs)/60000;if(!shift.end)row.openShifts++;
  }
 }
 return {rows:[...rows.values()].filter(r=>r.commissionCents||r.tipCents||r.elapsedMinutes||r.openShifts),invalidRecords,unallocatedTipCents,asOf:asOf.toISOString()};
}
