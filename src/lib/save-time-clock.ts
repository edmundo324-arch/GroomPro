import {randomUUID} from 'node:crypto';
import {db} from './db';
import {applyClock,emptyClock,type ClockState} from './time-clock';
import {offlineCreateId} from './offline-transaction';

type ClockCommand = Omit<Parameters<typeof applyClock>[1],'revision'> & {revision?:number};
export async function saveTimeClock(tenantId:string,userId:string,actorUserId:string,locationId:string,b:ClockCommand,at:string,offline:boolean,quick=false){
 const key=(id:string)=>'TIME_CLOCK:'+id;
 return await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const where={tenantId_settingKey:{tenantId,settingKey:key(userId)}},row=await tx.tenantSetting.findUnique({where}),previous=(row?.value as unknown as ClockState)||emptyClock();
   const clock=applyClock(previous,{...b,revision:quick ? previous.revision : b.revision!},at,offlineCreateId()||randomUUID(),locationId,offline);
   await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:key(userId),value:clock as any},update:{value:clock as any}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'USER',entityId:userId,action:'TIME_CLOCK_'+b.action,summary:b.action==='CORRECT'?'Corrected employee time with a recorded reason.':'Recorded employee time.',details:{reason:String(b.reason||'').slice(0,2000),at,offline,previousRevision:previous.revision,...(b.action==='CORRECT'?{previous:previous.shifts.find(s=>s.id===b.shiftId),corrected:clock.shifts.find(s=>s.id===b.shiftId)}:{})}}});
   return clock;
  });
}
