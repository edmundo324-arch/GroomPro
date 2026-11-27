export type EmployeeArrivalLimit={maxAppointments:number;intervalMinutes:number};
export const arrivalLimitKey=(id:string)=>'EMPLOYEE_ARRIVAL_LIMIT:'+id;

export function parseEmployeeArrivalLimit(value:unknown):EmployeeArrivalLimit|null{
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw Error('Choose an appointment limit and an arrival interval.');
 const {maxAppointments,intervalMinutes}=value as Record<string,unknown>;
 if(typeof maxAppointments!=='number'||!Number.isInteger(maxAppointments)||maxAppointments<1||maxAppointments>100)throw Error('Choose a limit from 1 to 100 appointments.');
 if(typeof intervalMinutes!=='number'||!Number.isInteger(intervalMinutes)||intervalMinutes<1||intervalMinutes>1440)throw Error('Choose an arrival interval from 1 to 1,440 whole minutes.');
 return {maxAppointments,intervalMinutes};
}

export async function saveEmployeeArrivalLimit(tx:any,tenantId:string,id:string,value:unknown){
 if(value===undefined)return;
 const parsed=parseEmployeeArrivalLimit(value),settingKey=arrivalLimitKey(id);
 if(parsed===null){await tx.tenantSetting.deleteMany({where:{tenantId,settingKey}});return;}
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value:parsed},update:{value:parsed}});
}
