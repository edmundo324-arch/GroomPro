export const employeeContactFields = ['email','phone','cellPhone','smsNumber','address1','address2','city','state','postalCode','notes'] as const;
export const employeeDateFields = ['dateOfBirth','lastWorkDate'] as const;
export const employeeProfileFields = [...employeeContactFields,...employeeDateFields,'independent'] as const;
export const employeeHrFields = ['country','emergencyName','emergencyPhone','emergencyRelationship','payrollReference','payFrequency','workArrangement'] as const;
export type EmployeePrivateForm = Partial<Record<typeof employeeContactFields[number]|typeof employeeDateFields[number],string|null>> & {independent?:boolean;hr?:Partial<Record<typeof employeeHrFields[number],string|null>>};
export const employeeHrKey=(id:string)=>'EMPLOYEE_HR:'+id;
export const employeeProfileSelect={email:true,phone:true,cellPhone:true,smsNumber:true,address1:true,address2:true,city:true,state:true,postalCode:true,dateOfBirth:true,lastWorkDate:true,independent:true,notes:true} as const;
export const employeePayFrequencies=[['WEEKLY','Weekly'],['EVERY_TWO_WEEKS','Every 2 Weeks'],['TWICE_MONTHLY','Twice Monthly'],['MONTHLY','Monthly'],['OTHER','Other']] as const;
export const employeeWorkArrangements=[['FULL_TIME','Full Time'],['PART_TIME','Part Time'],['SEASONAL','Seasonal'],['TEMPORARY','Temporary']] as const;

function optionalText(value:unknown,label:string,max=191){
 if(value===null||value==='')return null;
 if(typeof value!=='string'||value.trim().length>max)throw Error(`Enter ${label} using no more than ${max.toLocaleString()} characters.`);
 return value.trim()||null;
}
export function parseEmployeeProfileFields(input:Record<string,unknown>){
 const data:Record<string,any>={};
 for(const key of employeeContactFields){if(input[key]===undefined)continue;data[key]=optionalText(input[key],key==='notes'?'employee notes':key,key==='notes'?20000:191);}
 if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error('Enter a valid employee email address.');
 for(const key of employeeDateFields){if(input[key]===undefined)continue;const value=input[key];if(value===null||value===''){data[key]=null;continue;}if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a valid date.');const date=new Date(value+'T12:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw Error('Choose a valid date.');data[key]=date;}
 if(input.independent!==undefined){if(typeof input.independent!=='boolean')throw Error('Choose Employee or Independent Contractor.');data.independent=input.independent;}
 return data;
}
export function parseEmployeeHr(value:unknown):EmployeePrivateForm['hr']|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Review the employee details and try again.');
 const input=value as Record<string,unknown>,data:NonNullable<EmployeePrivateForm['hr']>={};
 for(const key of employeeHrFields){if(input[key]===undefined)continue;data[key]=optionalText(input[key],key);}
 for(const [key,options] of [['payFrequency',employeePayFrequencies],['workArrangement',employeeWorkArrangements]] as const){if(data[key]&&!options.some(([id])=>id===data[key]))throw Error(key==='payFrequency'?'Choose a listed pay frequency.':'Choose a listed work arrangement.');}
 return data;
}
export async function saveEmployeeHr(tx:any,tenantId:string,id:string,changes:EmployeePrivateForm['hr']){
 if(!changes||!Object.keys(changes).length)return;
 const key={tenantId,settingKey:employeeHrKey(id)},current=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:key}}),previous=current?.value;
 const value={...(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{}),...changes};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
}
