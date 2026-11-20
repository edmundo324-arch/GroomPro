export const shiftLocationKey=(id:string)=>'EMPLOYEE_SHIFT_LOCATION:'+id;
export const dateLocationKey=(userId:string,date:string)=>'EMPLOYEE_DATE_LOCATION:'+userId+':'+date;
export function resolveShiftLocation(explicit:unknown,assigned:unknown,locations:{id:string}[]){
 const ids=new Set(locations.map(l=>l.id));
 if(typeof explicit==='string'&&explicit)return ids.has(explicit)?explicit:null;
 if(typeof assigned==='string'&&assigned)return ids.has(assigned)?assigned:null;
 return locations.length===1?locations[0].id:null;
}
export async function employeeLocationContext(tx:any,tenantId:string){
 const [locations,rows]=await Promise.all([tx.location.findMany({where:{tenantId},select:{id:true,name:true,timezone:true}}),tx.tenantSetting.findMany({where:{tenantId,OR:[{settingKey:{startsWith:'EMPLOYEE_SHIFT_LOCATION:'}},{settingKey:{startsWith:'EMPLOYEE_DATE_LOCATION:'}}]},select:{settingKey:true,value:true}})]);
 const values=new Map<string,any>(rows.map((r:any)=>[r.settingKey,r.value]));
 return {locations,shift:(id:string,assigned?:string|null)=>resolveShiftLocation(values.get(shiftLocationKey(id))?.locationId,assigned,locations),date:(userId:string,date:string,assigned?:string|null)=>resolveShiftLocation(values.get(dateLocationKey(userId,date))?.locationId,assigned,locations)};
}
export async function saveShiftLocation(tx:any,tenantId:string,key:string,locationId:string){const value={locationId};await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:key}},create:{tenantId,settingKey:key,value},update:{value}});}
export function requireShiftLocation(requested:unknown,current:string|null,locations:{id:string}[]){const locationId=requested===undefined?current:typeof requested==='string'?requested:null;if(!locationId||!locations.some(l=>l.id===locationId))throw Error('Choose the shop for this shift in Schedule. These hours cannot be offered online until a shop is assigned.');return locationId;}
