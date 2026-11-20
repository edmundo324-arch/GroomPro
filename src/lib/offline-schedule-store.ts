import {employeeLocationContext} from './employee-shift-location';
import {db} from './db';
import {catalogVersion} from './catalog-version';
export async function scheduleSnapshot(tenantId:string,tx:any=db){
 const [schedules,assetSchedules,overrides]=await Promise.all([
 tx.$queryRaw`SELECT id,userId,dayOfWeek,startTime,endTime,active FROM EmployeeSchedule WHERE tenantId=${tenantId} ORDER BY id`,
 tx.$queryRaw`SELECT s.id,s.assetId,s.dayOfWeek,s.startTime,s.endTime,s.active FROM BookingAssetSchedule s JOIN BookingAsset a ON a.id=s.assetId WHERE a.tenantId=${tenantId} ORDER BY s.id`,
 tx.scheduleOverride.findMany({where:{tenantId},orderBy:{id:'asc'}})]);
 const [context,employees]=await Promise.all([employeeLocationContext(tx,tenantId),tx.user.findMany({where:{tenantId},select:{id:true,locationId:true}})]);const assigned=new Map<string,string|null>(employees.map((e:any)=>[e.id,e.locationId]));
 const data={locations:context.locations,employeeLocations:Object.fromEntries(assigned),schedules:schedules.map((s:any)=>({...s,locationId:context.shift(s.id,assigned.get(s.userId))})),assetSchedules,overrides:overrides.map((o:any)=>({...o,locationId:o.resourceKind==='employee'?context.date(o.resourceId,o.date,assigned.get(o.resourceId)):null}))};return {id:'all',...data,_offlineVersion:catalogVersion(data)};
}
