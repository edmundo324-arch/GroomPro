import {db} from './db';
const select={id:true,updatedAt:true,appointmentEmail:true,appointmentSms:true} as const;
const fail=(message:string)=>Object.assign(Error(message),{name:'PortalError'});
function snapshot(row:{updatedAt:Date;appointmentEmail:boolean;appointmentSms:boolean}){return {revision:row.updatedAt.toISOString(),appointmentEmail:row.appointmentEmail,appointmentSms:row.appointmentSms};}
export async function readPortalMessagePreferences(tenantId:string,customerId:string){
 const row=await db.customer.findFirst({where:{tenantId,id:customerId,active:true},select});
 if(!row)throw fail('Your customer profile is unavailable. Contact the shop before changing your message choices.');
 return snapshot(row);
}
export async function savePortalMessagePreferences(tenantId:string,customerId:string,input:any){
 if(typeof input?.revision!=='string'||typeof input.appointmentEmail!=='boolean'||typeof input.appointmentSms!=='boolean')throw fail('Choose whether you want appointment emails and texts, then save your choices.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} FOR UPDATE`;
  const row=await tx.customer.findFirst({where:{tenantId,id:customerId,active:true},select});
  if(!row)throw fail('Your customer profile is unavailable. Contact the shop before changing your message choices.');
  if(row.updatedAt.toISOString()!==input.revision)throw fail('Your profile changed while you were choosing messages. Select Review saved choices before saving again.');
  const data={appointmentEmail:input.appointmentEmail,appointmentSms:input.appointmentSms};
  const saved=await tx.customer.update({where:{id:row.id},data,select});
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'CUSTOMER',entityId:row.id,customerId:row.id,action:'CUSTOMER_MESSAGE_PREFERENCES',summary:'Customer updated appointment email and text choices through the verified portal.',details:{previous:{appointmentEmail:row.appointmentEmail,appointmentSms:row.appointmentSms},...data}}});
  return snapshot(saved);
 });
}
