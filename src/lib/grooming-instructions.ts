import {db} from './db';
import {defaultCareStages,careInstructions} from './grooming-experience';
export const careInstructionsKey='GROOMING_CARE_INSTRUCTIONS';
export async function readCareInstructions(tenantId:string,client:any=db){const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:careInstructionsKey}}});const value=row?.value as any;return {revision:value?.revision||0,stages:value?.stages?careInstructions(value.stages):defaultCareStages};}
export async function saveCareInstructions(tenantId:string,actor:string,revision:number,input:unknown){const stages=careInstructions(input);return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const old=await readCareInstructions(tenantId,tx);if(old.revision!==revision)throw Error('Another person changed these instructions. Your edits are still here; reopen this section to review the saved version.');
 const value={revision:old.revision+1,stages},where={tenantId_settingKey:{tenantId,settingKey:careInstructionsKey}};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:careInstructionsKey,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor,entityType:'TENANT',entityId:tenantId,action:'GROOMING_CARE_INSTRUCTIONS',summary:'Updated the seven-stage care instructions.',details:{revision:value.revision}}});return value;
 });}
