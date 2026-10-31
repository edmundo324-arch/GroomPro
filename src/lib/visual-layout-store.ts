import {retainLayoutVersions} from './visual-layout';
export async function saveLayoutVersion(tx:any,tenantId:string,key:string,value:any,previous:any,actorId:string){
 const where={tenantId_settingKey:{tenantId,settingKey:'LAYOUT_HISTORY:'+key}},row=await tx.tenantSetting.findUnique({where});
 const history=retainLayoutVersions(row?.value as any||[],value,actorId,previous);
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:'LAYOUT_HISTORY:'+key,value:history},update:{value:history}});return history;
}
