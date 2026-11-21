import {prepaidBalances} from './report-calculations';
export {prepaidBalances} from './report-calculations';
import {remainingPrepaidValues} from './prepaid-lines';
import {db} from './db';

export async function prepaidReport(tenantId:string,locationId:string,start:Date,end:Date){const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:'}},select:{value:true}});const purchases=rows.map(r=>r.value as any),ids=[...new Set<string>(purchases.map(p=>p.customerId).filter(Boolean))];const customers=ids.length?await db.customer.findMany({where:{tenantId,id:{in:ids}},select:{id:true}}):[];const allowed=new Set(customers.map(c=>c.id));return prepaidBalances(purchases.filter(p=>allowed.has(p.customerId)),locationId,start,end);}
