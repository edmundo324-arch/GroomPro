import {db} from './db';
import {catalogVersion} from './catalog-version';
export async function scheduleSnapshot(tenantId:string,tx:any=db){
 const [schedules,assetSchedules,overrides]=await Promise.all([
 tx.$queryRaw`SELECT id,userId,dayOfWeek,startTime,endTime,active FROM EmployeeSchedule WHERE tenantId=${tenantId} ORDER BY id`,
 tx.$queryRaw`SELECT s.id,s.assetId,s.dayOfWeek,s.startTime,s.endTime,s.active FROM BookingAssetSchedule s JOIN BookingAsset a ON a.id=s.assetId WHERE a.tenantId=${tenantId} ORDER BY s.id`,
 tx.scheduleOverride.findMany({where:{tenantId},orderBy:{id:'asc'}})]);
 const data={schedules,assetSchedules,overrides};return {id:'all',...data,_offlineVersion:catalogVersion(data)};
}
