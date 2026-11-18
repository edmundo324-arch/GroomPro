import {parseDate,selectedScheduleDates,validShift} from './schedule-dates';
export function editOfflineSchedule(data:any,path:string,method:string,b:any,id:string){
 if(path==='/api/schedule-overrides'){
  const kind=String(b.resourceKind||''),resourceId=String(b.resourceId||''),date=String(b.date||b.startDate||'');parseDate(date);
  if(!['employee','asset'].includes(kind)||!resourceId)throw Error('Choose an employee or booking asset.');
  const dates=method==='DELETE'?[date]:b.startDate?selectedScheduleDates(String(b.startDate),String(b.endDate),b.weekdays):[date];
  if(method!=='DELETE'&&(typeof b.dayOff!=='boolean'||!b.dayOff&&!validShift(String(b.startTime||''),String(b.endTime||''))))throw Error('Enter valid working hours or choose off.');
  if(b.absence==='SICK'&&(kind!=='employee'||!b.dayOff||dates.length!==1))throw Error('A sick call applies to one employee and date.');
  for(const day of dates){data.overrides=data.overrides.filter((r:any)=>!(r.resourceKind===kind&&r.resourceId===resourceId&&r.date===day));if(method!=='DELETE')data.overrides.push({id:id+'-'+day,resourceKind:kind,resourceId,date:day,dayOff:b.dayOff,startTime:b.dayOff?null:b.startTime,endTime:b.dayOff?null:b.endTime});}
 }else{
  const employee=path==='/api/employee-schedules',key=employee?'userId':'assetId',rows=employee?data.schedules:data.assetSchedules;
  const old=b.id?rows.find((r:any)=>r.id===b.id):null;
  if(b.id&&!old)throw Error('This shift is not available on this device.');
  const resourceId=b[key]||old?.[key],day=Number(b.dayOfWeek??old?.dayOfWeek);
  if(!resourceId||!Number.isInteger(day)||day<0||day>6)throw Error('Choose a resource and weekday.');
  if(method==='DELETE'){const kept=rows.filter((r:any)=>b[key]!==undefined?!(r[key]===resourceId&&Number(r.dayOfWeek)===day):r.id!==b.id);if(employee)data.schedules=kept;else data.assetSchedules=kept;}
  else {if(!validShift(String(b.startTime||''),String(b.endTime||'')))throw Error('Enter valid hours with start before end.');if(old&&(old[key]!==resourceId||Number(old.dayOfWeek)!==day))throw Error('This shift belongs to a different resource or weekday.');const row={id:old?.id||id,[key]:resourceId,dayOfWeek:day,startTime:b.startTime,endTime:b.endTime,active:true};if(old)Object.assign(old,row);else rows.push(row);}
 }
 return {ok:true};
}
