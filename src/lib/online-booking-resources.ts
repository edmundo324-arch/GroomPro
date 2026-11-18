export const employeeOnlineKey=(id:string)=>'EMPLOYEE_AVAILABLE_ONLINE:'+id;
export async function saveEmployeeOnline(tx:any,tenantId:string,id:string,value:unknown){
 if(value===undefined)return;
 if(typeof value!=='boolean')throw Error('Choose whether this employee is available online.');
 const settingKey=employeeOnlineKey(id);
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});
}
