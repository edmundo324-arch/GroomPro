import {effectiveShift,parseDate,validShift,type DateOverride} from './schedule-dates';

type Shift={userId:string;dayOfWeek:number;startTime:string;endTime:string;active?:boolean|number;locationId?:string|null};
// This picker follows working days. Hours/overlap warnings still belong to the
// existing save flow, including its explicitly approved scheduling exceptions.
export function scheduledEmployeeIds(date:string,locationId:string,shifts:Shift[],overrides:DateOverride[]):string[]{
 parseDate(date);
 if(!locationId)return [];
 const localShifts=shifts.filter(s=>s.locationId===undefined||s.locationId===locationId);
 const localOverrides=overrides.map(o=>o.locationId!==undefined&&o.locationId!==locationId?{...o,dayOff:true}:o);
 const ids=new Set([...shifts.map(s=>s.userId),...overrides.filter(o=>o.resourceKind==='employee').map(o=>o.resourceId)]);
 return [...ids].filter(id=>{const shift=effectiveShift(localShifts.filter(s=>s.userId===id),localOverrides,'employee',id,date);return !!shift&&validShift(shift.startTime,shift.endTime)});
}

export function plannedEmployeeChoices<T extends {id:string;active?:boolean}>(employees:T[],workingIds:readonly string[]|undefined,currentId:string){
 const working=workingIds===undefined?null:new Set(workingIds);
 return employees.filter(e=>e.id===currentId||e.active&&(!working||working.has(e.id)));
}
