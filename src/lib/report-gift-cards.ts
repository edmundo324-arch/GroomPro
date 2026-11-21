import {giftCardBalances} from './report-calculations';
export {giftCardBalances} from './report-calculations';
import {db} from './db';

export async function giftCardReport(tenantId:string,locationId:string,start:Date,end:Date,asOf:Date){const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'GIFT_CARD:'}},select:{value:true}});return giftCardBalances(rows.map(r=>r.value),locationId,start,end,asOf);}
