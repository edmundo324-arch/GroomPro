import {db} from './db';
import {hashPin,hashPinPrefixes,pinAssignmentError} from './pin';
import {pinVaultConfigured,pinVaultKey,sealPin} from './pin-vault';
export async function saveWithPin(tenantId:string,pin:string,id:string|undefined,data:any,client:any=db){
 if(!/^\d{6,10}$/.test(pin))throw Error("PIN needs attention. Enter 6 to 10 digits.");
 const pinHash=await hashPin(pin),pinPrefixHashes=await hashPinPrefixes(pin);
 const save=async (tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${tenantId} FOR UPDATE`;
  const others=await tx.user.findMany({where:{tenantId,...(id?{id:{not:id}}:{})},select:{pinHash:true,pinPrefixHashes:true}});
  const error=await pinAssignmentError(pin,others);if(error)throw new Error(error);
  const user=await (id?tx.user.update({where:{id},data:{...data,pinHash,pinPrefixHashes}}):tx.user.create({data:{...data,pinHash,pinPrefixHashes}}));
  const settingKey=pinVaultKey(user.id);
  if(pinVaultConfigured()){const value=sealPin(pin,tenantId,user.id);await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}})}
  else await tx.tenantSetting.deleteMany({where:{tenantId,settingKey}});
  if(id)await tx.employeeSession.updateMany({where:{tenantId,userId:id,endedAt:null},data:{endedAt:new Date()}});
  return user;
 };
 return client.$transaction?client.$transaction(save,{timeout:30000}):save(client);
}

