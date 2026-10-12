import {baseBreeds,Breed} from './breed-classification';
export const breedSettingKey='BREED_DICTIONARY_V1';
export async function loadBreeds(db:any,tenantId:string):Promise<Breed[]>{
 const setting=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:breedSettingKey}}});
 const custom=Array.isArray(setting?.value)?setting.value as Breed[]:[];
 return [...baseBreeds.filter(b=>!custom.some(c=>c.id===b.id)),...custom];
}
