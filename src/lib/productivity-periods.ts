import {localToInstant,zonedParts} from './operating-hours';
// Today is scheduled time, even if part of its shift has already elapsed.
export function productivityPeriods(start:Date,end:Date,asOf:Date,timezone:string){
 if(![start,end,asOf].every(d=>Number.isFinite(+d))||end<=start)throw Error('Choose a valid report date range.');
 const today=localToInstant(zonedParts(asOf,timezone).date+'T00:00',timezone);
 return {past:start<today?{start,end:new Date(Math.min(+end,+today))}:null,planned:end>today?{start:new Date(Math.max(+start,+today)),end}:null};
}
type Shift={userId:string;locationId:string|null;dayOfWeek:number;startTime:string;endTime:string;active?:boolean|number};
type Override={resourceId:string;resourceKind:string;locationId:string|null;date:string;dayOff:boolean;startTime:string|null;endTime:string|null};
export function productivityScheduledMinutes(employees:{id:string}[],shifts:Shift[],overrides:Override[],locationId:string,start:Date,end:Date,timezone:string){
 const rows=new Map(employees.map(e=>[e.id,{userId:e.id,minutes:0,invalidShifts:0,unassignedShopShifts:0}]));
 if(end<=start)return [...rows.values()];
 let date=zonedParts(start,timezone).date;const last=zonedParts(new Date(+end-1),timezone).date;
 while(date<=last){const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  for(const row of rows.values()){
   const override=overrides.find(o=>o.resourceKind==='employee'&&o.resourceId===row.userId&&o.date===date);
   const windows=override?(override.dayOff?[]:[override]):shifts.filter(s=>s.userId===row.userId&&Number(s.dayOfWeek)===weekday&&s.active!==false&&s.active!==0);
   const intervals:number[][]=[];
   for(const w of windows){if(!w.locationId){row.unassignedShopShifts++;continue;}if(w.locationId!==locationId)continue;
    if(!w.startTime||!w.endTime||!/^([01]\d|2[0-3]):[0-5]\d$/.test(w.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(w.endTime)||w.endTime<=w.startTime){row.invalidShifts++;continue;}
    try{const a=Math.max(+start,+localToInstant(date+'T'+w.startTime,timezone)),b=Math.min(+end,+localToInstant(date+'T'+w.endTime,timezone));if(b>a)intervals.push([a,b]);}catch{row.invalidShifts++;}
   }
   intervals.sort((a,b)=>a[0]-b[0]);let lastEnd=-Infinity;for(const [a,b] of intervals){row.minutes+=Math.max(0,b-Math.max(a,lastEnd))/60000;lastEnd=Math.max(lastEnd,b);}
  }
  date=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 }
 return [...rows.values()];
}
