import {refundReport} from './report-calculations';
export {refundReport} from './report-calculations';
import {db} from './db';
export async function refundReportRecords(tenantId:string,locationId:string){const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'TICKET_REFUND:'}},select:{value:true}}),records=rows.map(r=>r.value as any).filter(r=>r?.locationId===locationId),ids=[...new Set<string>(records.map(r=>r.ticketId))];const tickets=ids.length?await db.ticket.findMany({where:{tenantId,locationId,id:{in:ids}},select:{id:true}}):[];const allowed=new Set(tickets.map(t=>t.id));return records.filter(r=>allowed.has(r.ticketId));}
