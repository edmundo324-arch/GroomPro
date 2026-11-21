import {createHash} from 'node:crypto';
export const marketingLimitKey='MARKETING_MESSAGE_LIMIT';
export const defaultMarketingLimit={revision:0,maximum:1,period:'WEEK' as 'DAY'|'WEEK'};
export type MarketingLimit=typeof defaultMarketingLimit;
export function marketingLimit(value:any):MarketingLimit {
 if(!value)return {...defaultMarketingLimit};
 if(!Number.isSafeInteger(value.revision)||value.revision<0||!Number.isSafeInteger(value.maximum)||value.maximum<1||value.maximum>100||!['DAY','WEEK'].includes(value.period))throw Error('Choose between 1 and 100 marketing messages per customer, per day or week.');
 return {revision:value.revision,maximum:value.maximum,period:value.period};
}
export async function readMarketingLimit(tx:any,tenantId:string){return marketingLimit((await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:marketingLimitKey}}}))?.value);}
// One customer lock coordinates all marketing sources and both delivery channels.
// Count reserved sends as well as accepted sends: an uncertain provider response
// must not allow another promotion to slip through. No customer data leaves here.
export async function reserveMarketingMessage(client:any,tenantId:string,customerId:string,eventId:string,now=new Date()){
 if(!eventId||eventId.length>500||!Number.isFinite(+now))throw Error('This marketing message could not be identified. Review its rule before sending.');
 return client.$transaction(async(tx:any)=>{
  const customers=await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!customers.length)throw Error('This customer is not available in this business.');
  const policy=await readMarketingLimit(tx,tenantId),windowMs=(policy.period==='WEEK'?7:1)*86400000;
  const settingKey='MARKETING_MESSAGE_USAGE:'+createHash('sha256').update(customerId).digest('hex'),where={tenantId_settingKey:{tenantId,settingKey}};
  const stored=(await tx.tenantSetting.findUnique({where}))?.value;
  // Retain seven days even when a tenant chooses a daily limit, so changing
  // back to weekly does not forget messages already sent this week.
  const entries=(Array.isArray(stored?.entries)?stored.entries:[]).filter((e:any)=>typeof e.eventId==='string'&&Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)>+now-7*86400000);
  const previous=entries.find((e:any)=>e.eventId===eventId);
  if(previous)return {allowed:true,alreadyReserved:true};
  const recent=entries.filter((e:any)=>Date.parse(e.at)>+now-windowMs);
  if(recent.length>=policy.maximum)return {allowed:false,alreadyReserved:false};
  entries.push({eventId,at:now.toISOString()});
  const value={customerId,entries};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
  return {allowed:true,alreadyReserved:false};
 });
}
