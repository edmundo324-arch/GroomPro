import {db} from './db';
import {customerRetention,retentionSettingKey,retentionWeeks} from './report-retention';
export async function retentionReport(tenantId:string,asOf:Date,start:Date,end:Date,timezone:string){
 const [setting,customers]=await Promise.all([db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:retentionSettingKey}}}),db.customer.findMany({where:{tenantId,active:true},select:{id:true,firstName:true,lastName:true}})]);
 const weeks=setting?retentionWeeks(setting.value):6,ids=customers.map(c=>c.id);
 const [tickets,upcoming]=ids.length?await Promise.all([db.ticket.findMany({where:{tenantId,customerId:{in:ids},status:'CLOSED',closedAt:{lte:asOf},lines:{some:{lineType:'SERVICE',petId:{not:null},role:{in:['GROOM','BATH','PREP','DRY']}}}},select:{customerId:true,status:true,closedAt:true,lines:{select:{lineType:true,role:true,petId:true}}}}),db.ticket.findMany({where:{tenantId,customerId:{in:ids},scheduledStart:{gt:asOf},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{customerId:true,scheduledStart:true,status:true,bookingDecision:true}})]):[[],[]];
 return customerRetention(customers,tickets,upcoming,weeks,asOf,start,end,timezone);
}
