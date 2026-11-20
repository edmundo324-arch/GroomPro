import {db} from './db';
import {defaultCareStages} from './grooming-experience';
export const careProgressKey=(ticketId:string,petId:string)=>'GROOMING_PROGRESS:'+ticketId+':'+petId;
export type CareProgress={revision:number;stages:Record<string,{startedAt:string;startedBy:string;completedAt?:string;completedBy?:string}>};
export function changeCareProgress(old:CareProgress,stageId:string,action:string,actor:string,now:Date):CareProgress{
 if(!defaultCareStages.some(s=>s.id===stageId)||!['START','COMPLETE'].includes(action))throw Error('Choose a grooming stage and Start or Complete.');
 const stage=old.stages[stageId];if(action==='START'&&stage)throw Error('This stage already has a recorded start. Refresh to see its current progress.');
 if(action==='COMPLETE'&&(!stage||stage.completedAt))throw Error('Start this stage before completing it, or refresh to see its recorded completion.');
 if(stage&&now<new Date(stage.startedAt))throw Error('The completion time cannot be earlier than the start time.');
 return {revision:old.revision+1,stages:{...old.stages,[stageId]:action==='START'?{startedAt:now.toISOString(),startedBy:actor}:{...stage,completedAt:now.toISOString(),completedBy:actor}}};
}
export async function readCareProgress(tenantId:string,ticketId:string,petId:string){const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:careProgressKey(ticketId,petId)}}});return (row?.value as CareProgress|null)||{revision:0,stages:{}};}
export async function saveCareProgress(tenantId:string,locationId:string,actor:string,input:any){
 return db.$transaction(async tx=>{const ticketId=String(input.ticketId||''),petId=String(input.petId||'');await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND id=${ticketId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{tenantId,locationId,id:ticketId,OR:[{pets:{some:{petId}}},{lines:{some:{petId}}}]}});if(!ticket)throw Error('Choose a dog on this shop’s saved ticket.');if(['CLOSED','CANCELLED','VOIDED','NO_SHOW'].includes(ticket.status))throw Error('This ticket is no longer open for grooming progress. Its recorded stages remain available.');
 const where={tenantId_settingKey:{tenantId,settingKey:careProgressKey(ticketId,petId)}},row=await tx.tenantSetting.findUnique({where}),old=(row?.value as CareProgress|null)||{revision:0,stages:{}};
 if(input.revision!==old.revision)throw Error('Another employee updated this dog’s progress. Refresh before recording your change.');
 const progress=changeCareProgress(old,String(input.stageId),String(input.action),actor,new Date()),value={...progress,ticketId,petId,customerId:ticket.customerId};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:where.tenantId_settingKey.settingKey,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'GROOMING_STAGE_'+input.action,summary:(input.action==='START'?'Started ':'Completed ')+defaultCareStages.find(s=>s.id===input.stageId)!.name+'.',details:{petId,stageId:input.stageId,revision:progress.revision}}});return progress;
 });
}
