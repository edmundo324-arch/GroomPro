import {customRuleResults} from './report-calculations';
export {customRuleResults} from './report-calculations';
import {db} from './db';
import {ruleDeliveryPrefix} from './custom-rule-history';
import {staffTaskPrefix} from './staff-tasks';

export async function customRuleResultsReport(tenantId:string,start:Date,end:Date,userId:string,manager:boolean,client:any=db){
 const [audits,settings]=await Promise.all([client.auditEntry.findMany({where:{tenantId,action:{in:['CUSTOM_RULE_TASK','CUSTOM_RULE_NOTICE']},occurredAt:{gte:start,lt:end}}}),client.tenantSetting.findMany({where:{tenantId,OR:[{settingKey:{startsWith:ruleDeliveryPrefix}},{settingKey:{startsWith:'CUSTOM_RULE:'}},{settingKey:{startsWith:staffTaskPrefix}}]},select:{settingKey:true,value:true}})]);
 const refs=settings.filter((s:any)=>s.settingKey.startsWith(ruleDeliveryPrefix)).map((s:any)=>s.value).filter((v:any)=>new Date(v.recordedAt)>=start&&new Date(v.recordedAt)<end);
 const ids=[...new Set<string>([...refs.map((r:any)=>r.customerId),...audits.map((a:any)=>a.customerId)].filter(Boolean))],customers=ids.length?await client.customer.findMany({where:{tenantId,id:{in:ids}},select:{id:true}}):[],allowed=new Set(customers.map((c:any)=>c.id));
 const visible=refs.filter((r:any)=>allowed.has(r.customerId)),staff=audits.filter((a:any)=>(!a.customerId||allowed.has(a.customerId))&&(manager||a.details?.assigneeId===userId));
 const messages=visible.length?await client.communication.findMany({where:{tenantId,id:{in:visible.map((r:any)=>r.communicationId)}},select:{id:true,deliveryStatus:true,createdAt:true}}):[];
 const bookings=visible.length?await client.ticket.findMany({where:{tenantId,customerId:{in:[...new Set(visible.map((r:any)=>r.customerId))]},createdAt:{gte:start},scheduledStart:{not:null},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED']},bookingDecision:{notIn:['REQUESTED','PENDING','REJECTED']}},select:{customerId:true,createdAt:true,scheduledStart:true,status:true,bookingDecision:true}}):[];
 const names=new Map<string,string>(settings.filter((s:any)=>s.settingKey.startsWith('CUSTOM_RULE:')).map((s:any)=>[s.value.id,s.value.name]));
 return {...customRuleResults(staff,visible,messages,settings.filter((s:any)=>s.settingKey.startsWith(staffTaskPrefix)).map((s:any)=>s.value),names,bookings),staffScope:manager?'TEAM':'SELF'};
}
