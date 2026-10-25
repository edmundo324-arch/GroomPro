import {db} from './db';
export const platformAccessKey='PLATFORM_ACCESS';
export async function platformRestriction(tenantId:string,userId?:string){
 const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:platformAccessKey}}});
 const value=row?.value as any;
 if(value?.suspended)return 'Business access is suspended. Contact GroomPro support.';
 if(userId&&value?.blockedUserIds?.includes(userId))return 'This employee’s access is suspended. Contact GroomPro support.';
 return null;
}
