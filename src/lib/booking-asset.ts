import {db} from './db';
import {resourceBlocked} from './calendar-blocks';
import {zonedParts} from './operating-hours';
export async function bookingAssetError(tenantId:string,locationId:string,id:string|null|undefined,start:Date,duration:number){
 if(!id)return null;
 const rows=await db.$queryRaw<any[]>`SELECT id FROM BookingAsset WHERE id=${id} AND tenantId=${tenantId} AND locationId=${locationId} AND active=1`;
 if(!rows.length)return 'Booking asset is unavailable.';
 if(await resourceBlocked(tenantId,locationId,'asset',id,start,duration))return 'This booking asset has a time block at the selected time.';
 const location=await db.location.findFirst({where:{id:locationId,tenantId}}),zone=location?.timezone||'America/Chicago';
 const a=zonedParts(start,zone),b=zonedParts(new Date(+start+Math.max(1,duration)*60000),zone);
 if(a.date!==b.date)return 'Choose a time within the booking asset’s availability.';
 const override=await db.scheduleOverride.findUnique({where:{tenantId_resourceKind_resourceId_date:{tenantId,resourceKind:'asset',resourceId:id,date:a.date}}});
 if(override)return !override.dayOff&&override.startTime&&override.endTime&&a.time>=override.startTime&&b.time<=override.endTime?null:'Choose a time within the booking asset’s availability.';
 const day=new Date(a.date+'T12:00:00Z').getUTCDay();
 const shifts=await db.$queryRaw<any[]>`SELECT startTime,endTime FROM BookingAssetSchedule WHERE assetId=${id} AND dayOfWeek=${day} AND active=1`;
 return shifts.some(s=>a.time>=s.startTime&&b.time<=s.endTime)?null:'Choose a time within the booking asset’s availability.';
}
