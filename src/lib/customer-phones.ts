import {normalizePhone} from './customer';
export async function saveCustomerPhones(tx:any,tenantId:string,customerId:string,input:any){
 if(!Array.isArray(input)||input.length>200)throw Error('Provide up to 200 phone contacts.');
 const phones=input.map((p:any)=>{const number=String(p.number||'').trim(),normalized=normalizePhone(number);if(normalized.length<7||normalized.length>15)throw Error('Enter a valid phone number.');return{id:p.id?String(p.id):undefined,number,normalized,contactName:String(p.contactName||'').trim()||null,relationship:String(p.relationship||'').trim()||null,label:String(p.label||'').trim()||null,isPrimary:!!p.isPrimary,smsEnabled:p.smsEnabled!==false,callEnabled:p.callEnabled!==false}});
 if(phones.some(p=>[p.contactName,p.relationship,p.label,p.number].some(v=>v&&v.length>191)))throw Error('Contact fields must be 191 characters or fewer.');
 if(new Set(phones.filter(p=>p.id).map(p=>p.id)).size!==phones.filter(p=>p.id).length)throw Error('Each phone contact must be listed once.');
 if(new Set(phones.map(p=>p.normalized)).size!==phones.length||phones.filter(p=>p.isPrimary).length>1)throw Error('Use distinct numbers and one primary contact.');
 const existing=await tx.customerPhone.findMany({where:{tenantId,customerId}});for(const p of phones){if(p.id&&!existing.some((e:any)=>e.id===p.id))throw Error('Phone does not belong to this customer.');const conflict=await tx.customerPhone.findFirst({where:{tenantId,normalized:p.normalized,customerId:{not:customerId}}});if(conflict)throw Error('A phone number is already linked to another customer.');}
 // Replace within the caller's transaction so swapping two existing numbers is valid.
 await tx.customerPhone.deleteMany({where:{tenantId,customerId}});
 for(const p of phones)await tx.customerPhone.create({data:{tenantId,customerId,...p}});
}
