import {randomUUID} from 'node:crypto';
export async function advanceIntegrationRevision(tx:any,tenantId:string){
 const settingKey='123PET_DATA_REVISION',value={revision:randomUUID(),changedAt:new Date().toISOString()};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});
}
