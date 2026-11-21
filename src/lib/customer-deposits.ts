import {db} from './db';
import {addAccountEntry} from './customer-account';
export const depositMethods=['CASH','VISA','MASTERCARD','AMEX','DISCOVER','DEBIT','OTHER'] as const;
export const customerDepositKey=(id:string)=>'CUSTOMER_DEPOSIT:'+id;
export function depositInput(input:any){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input?.id||''))throw Error('Reopen the deposit form before recording it.');if(!Number.isSafeInteger(input.amountCents)||input.amountCents<=0||input.amountCents>2147483647)throw Error('Enter the deposit received, using a positive amount with up to two decimal places.');if(!depositMethods.includes(input.method))throw Error('Choose how the deposit was received.');if(typeof input.note!=='string'||input.note.length>1000)throw Error('Keep the deposit note within 1,000 characters.');return{id:input.id,amountCents:input.amountCents,method:String(input.method),note:input.note.trim()};}
export async function recordCustomerDeposit(tenantId:string,actorUserId:string,customerId:string,locationId:string,input:any,client:any=db){const deposit=depositInput(input);return client.$transaction(async(tx:any)=>{
 const customers=await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
 if(!customers.length||!await tx.customer.findFirst({where:{tenantId,id:customerId}}))throw Error('Choose a customer available to this shop.');
 if(!await tx.location.findFirst({where:{tenantId,id:locationId}}))throw Error('Choose the shop receiving this deposit.');
 const where={tenantId_settingKey:{tenantId,settingKey:customerDepositKey(deposit.id)}},previous=(await tx.tenantSetting.findUnique({where}))?.value;
 if(previous){if(previous.customerId!==customerId||previous.locationId!==locationId||previous.amountCents!==deposit.amountCents||previous.method!==deposit.method||previous.note!==deposit.note)throw Error('This deposit was already recorded with different details. Review the customer’s account before entering another.');return {deposit:previous,repeated:true};}
 const recordedAt=new Date().toISOString(),value={...deposit,tenantId,customerId,locationId,actorUserId,recordedAt};
 await addAccountEntry({tenantId,customerId,actorUserId,entryType:'CREDIT',amountCents:deposit.amountCents,reason:'Appointment deposit received'+(deposit.note?': '+deposit.note:'.'),referenceId:customerDepositKey(deposit.id)},tx);
 await tx.tenantSetting.create({data:{tenantId,settingKey:customerDepositKey(deposit.id),value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'CUSTOMER',entityId:customerId,customerId,action:'CUSTOMER_DEPOSIT',summary:'Recorded $'+(deposit.amountCents/100).toFixed(2)+' deposit as Customer Credit.',details:value}});
 return {deposit:value,repeated:false};
 });}
