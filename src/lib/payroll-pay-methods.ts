export const payrollPayMethods=[['HOURLY','Hourly'],['COMMISSION_ONLY','Commission Only'],['HOURLY_PLUS_COMMISSION','Hourly Plus Commission'],['WHICHEVER_IS_HIGHER','Whichever Is Higher'],['SALARY','Salary']] as const;
export type PayrollPayMethod=typeof payrollPayMethods[number][0];
export type PayrollPayMode='PER_EMPLOYEE'|'COMMON';
export type PayrollSettings={mode:PayrollPayMode;commonMethod:PayrollPayMethod|null;revision:number};
export type EmployeePayMethod={method:PayrollPayMethod|null;revision:number};
export type PayrollContext={settings:PayrollSettings;employee?:EmployeePayMethod&{effectiveMethod:PayrollPayMethod|null}};
export const payrollSettingsKey='PAYROLL_PAY_METHOD_SETTINGS';
export const employeePayMethodKey=(id:string)=>'EMPLOYEE_PAY_METHOD:'+id;
export const payrollPreparationNotice='Payroll payments and tax filings are not connected.';
export const payrollMethodLabel=(method:PayrollPayMethod|null)=>payrollPayMethods.find(([id])=>id===method)?.[1]||'Not Selected';
export function parsePayMethod(value:unknown,optional=false):PayrollPayMethod|null{
 if(optional&&(value===null||value===undefined||value===''))return null;
 if(!payrollPayMethods.some(([id])=>id===value))throw Error('Choose a listed pay method.');
 return value as PayrollPayMethod;
}
export function parsePayMode(value:unknown):PayrollPayMode{if(value!=='PER_EMPLOYEE'&&value!=='COMMON')throw Error('Choose how pay methods are assigned.');return value;}
export function payRevision(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('Reload the saved payroll settings before saving.');return value;}
export const payrollConflict=(message:string)=>Object.assign(new Error(message),{status:409});
export async function readPayrollContext(client:any,tenantId:string,userId?:string):Promise<PayrollContext>{
 const key={tenantId,settingKey:payrollSettingsKey},row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:key}}),value=row?.value;
 const settings:PayrollSettings=value?{mode:parsePayMode(value.mode),commonMethod:parsePayMethod(value.commonMethod,true),revision:payRevision(value.revision)}:{mode:'PER_EMPLOYEE',commonMethod:null,revision:0};
 if(settings.mode==='COMMON'&&!settings.commonMethod)throw Error('Select the shared pay method in Settings > Payroll.');
 if(!userId)return {settings};
 const employeeRow=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:employeePayMethodKey(userId)}}}),saved=employeeRow?.value;
 const employee:EmployeePayMethod=saved?{method:parsePayMethod(saved.method,true),revision:payRevision(saved.revision)}:{method:null,revision:0};
 return {settings,employee:{...employee,effectiveMethod:settings.mode==='COMMON'?settings.commonMethod:employee.method}};
}
export async function savePayrollSettings(client:any,tenantId:string,input:any):Promise<PayrollContext>{
 const current=await readPayrollContext(client,tenantId),mode=parsePayMode(input.mode),commonMethod=parsePayMethod(input.commonMethod,true);
 if(mode==='COMMON'&&!commonMethod)throw Error('Choose the pay method everyone will use.');
 if(payRevision(input.revision)!==current.settings.revision)throw payrollConflict('Payroll settings changed. Reload them before saving.');
 const value:PayrollSettings={mode,commonMethod,revision:current.settings.revision+1},key={tenantId,settingKey:payrollSettingsKey};
 await client.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
 return {settings:value};
}
export async function saveEmployeePayMethod(client:any,tenantId:string,userId:string,input:any):Promise<PayrollContext>{
 const current=await readPayrollContext(client,tenantId,userId);
 if(current.settings.mode!=='PER_EMPLOYEE')throw payrollConflict('This business uses one pay method for everyone. Change it in Settings > Payroll.');
 if(payRevision(input.businessRevision)!==current.settings.revision||payRevision(input.revision)!==current.employee!.revision)throw payrollConflict('Pay method settings changed. Reload them before saving.');
 const value={method:parsePayMethod(input.method),revision:current.employee!.revision+1},key={tenantId,settingKey:employeePayMethodKey(userId)};
 await client.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
 return {settings:current.settings,employee:{...value,effectiveMethod:value.method}};
}
