import {db} from './db';

// A database-backed tenant ceiling cannot be bypassed by changing browser cookies
// or by requests landing on a different application process.
export async function allowPinAttempt(tenantId:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${tenantId} FOR UPDATE`;
  const key={tenantId,settingKey:'PIN_ATTEMPTS'};
  const record=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:key}});
  const previous=record?.value as {window?:number;count?:number}|null;
  const now=Date.now(),expired=!previous?.window||now-previous.window>=60000;
  const count=expired?0:Number(previous?.count||0);
  if(count>=60)return false;
  const value={window:expired?now:previous!.window!,count:count+1};
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
  return true;
 });
}
