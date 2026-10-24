import {db} from './db';
import {factoryStyles,validateStyles} from './calendar-presentation';

// A reserved, platform-owned setting. Tenant settings endpoints cannot write this key.
export const manufacturerColorId='groompro-manufacturer-colors';
export async function manufacturerColors(client:any=db){
 const row=await client.tenantSetting.findUnique({where:{id:manufacturerColorId}});
 return {...factoryStyles(),...validateStyles((row?.value as any)?.statusStyles)};
}
