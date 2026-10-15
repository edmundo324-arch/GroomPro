import {db} from './db';
import {CalendarBlock,intervalsOverlap} from './calendar-interaction';
export async function calendarBlocks(tenantId:string,locationId:string,client:any=db):Promise<CalendarBlock[]>{const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:`CALENDAR_BLOCKS:${locationId}`}}});return Array.isArray(row?.value)?row.value:[]}
export async function resourceBlocked(tenantId:string,locationId:string,kind:string,id:string,start:Date,duration:number){const end=new Date(+start+Math.max(1,duration)*60000);return (await calendarBlocks(tenantId,locationId)).some(b=>b.resourceKind===kind&&b.resourceId===id&&intervalsOverlap(b.start,b.end,start.toISOString(),end.toISOString()))}
export async function onlineBlockError(tenantId:string,locationId:string,start:Date,duration:number,category?:string|null){
 const blocks=await calendarBlocks(tenantId,locationId),end=new Date(+start+Math.max(1,duration)*60000);
 const relevant=blocks.filter(b=>intervalsOverlap(b.start,b.end,start.toISOString(),end.toISOString()));
 if(!relevant.length)return null;
 const assets=await db.$queryRaw<{id:string;category:string}[]>`SELECT id,category FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId} AND active=1 AND onlineBookingRecipient=1`;
 const matching=assets.filter(a=>!category||a.category===category);
 if(matching.length&&matching.every(a=>relevant.some(b=>b.resourceKind==='asset'&&b.resourceId===a.id)))return 'Online booking is blocked for this resource and time. Choose another time.';
 const users=await db.user.findMany({where:{tenantId,active:true,OR:[{locationId},{locationId:null}],role:{in:['GROOMER','MASTER_GROOMER','BACK']}},select:{id:true}});
 const {employeeAvailable}=await import('./groomer-assignment');
 const available=[];for(const user of users)if(await employeeAvailable(tenantId,user.id,locationId,start,duration,true))available.push(user);
 if(available.length&&available.every(u=>relevant.some(b=>b.resourceKind==='employee'&&b.resourceId===u.id)))return 'Online booking is blocked for this time. Choose another time.';
 return null;
}
