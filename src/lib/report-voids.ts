import {voidReport} from './report-calculations';
export {voidReport} from './report-calculations';
import {db} from './db';
export async function voidReportRecords(tenantId:string,locationId:string){const records=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'TICKET_VOID:'}},select:{value:true}}),values=records.map(r=>r.value as any).filter(r=>r?.locationId===locationId&&r.ticketId);const ids=[...new Set<string>(values.map(r=>r.ticketId))],tickets=ids.length?await db.ticket.findMany({where:{tenantId,locationId,id:{in:ids}},select:{id:true}}):[];const allowed=new Set(tickets.map(t=>t.id));return values.filter(v=>allowed.has(v.ticketId));}
