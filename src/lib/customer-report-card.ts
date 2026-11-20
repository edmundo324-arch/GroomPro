import {db} from './db';
export const customerReportCardKey=(ticketId:string)=>'CUSTOMER_REPORT_CARD:'+ticketId;
export async function saveCustomerReportCard(tenantId:string,actorUserId:string,ticketId:string,input:any){
 const body=String(input.body||'').trim(),photoIds=input.photoIds;
 if(!body||body.length>10000||!Array.isArray(photoIds)||photoIds.length>20||photoIds.some(id=>typeof id!=='string')||new Set(photoIds).size!==photoIds.length)throw Error('Enter a report card of up to 10,000 characters and select up to 20 grooming photos.');
 return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND id=${ticketId} FOR UPDATE`;const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},select:{customerId:true,orderNumber:true}});if(!ticket)throw Error('This ticket is unavailable.');
 const where={tenantId_settingKey:{tenantId,settingKey:customerReportCardKey(ticketId)}},old=(await tx.tenantSetting.findUnique({where}))?.value as any;
 if(input.revision!==(old?.revision||0))throw Error('This report card changed. Reopen it before saving your version.');
 const rows=photoIds.length?await tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:photoIds.map(id=>'PET_PHOTO:'+id)}},select:{value:true}}):[];
 if(rows.reduce((n,r)=>n+Number((r.value as any).bytes||0),0)>15*1024*1024)throw Error('Choose photos totaling no more than 15 MB for this report card. All other photos remain in the dog’s history.');
 if(rows.length!==photoIds.length||rows.some(r=>(r.value as any).ticketId!==ticketId))throw Error('Choose grooming photos saved to this ticket.');
 const value={ticketId,customerId:ticket.customerId,revision:(old?.revision||0)+1,body,photoIds,updatedAt:new Date().toISOString(),updatedBy:actorUserId};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:customerReportCardKey(ticketId),value},update:{value}});
 await tx.tenantSetting.create({data:{tenantId,settingKey:'CUSTOMER_REPORT_CARD_VERSION:'+ticketId+':'+value.revision,value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'CUSTOMER_REPORT_CARD_SAVED',summary:'Saved the customer-facing grooming report card.',details:{revision:value.revision,photoIds}}});return value;
 });
}
export async function readCustomerReportCard(tenantId:string,ticketId:string,customerId?:string,revision?:number){
 const ticket=await db.ticket.findFirst({where:{tenantId,id:ticketId,...(customerId?{customerId}:{})},include:{tenant:{select:{name:true}},location:{select:{timezone:true,name:true}},customer:{select:{firstName:true,lastName:true}},pets:{include:{pet:{select:{name:true}}}}}});if(!ticket)throw Error('This report card is unavailable to this customer.');
 if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))throw Error('Choose a saved report-card version.');
 const saved=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:revision===undefined?customerReportCardKey(ticketId):'CUSTOMER_REPORT_CARD_VERSION:'+ticketId+':'+revision}}}))?.value as any;
 if(!saved||saved.customerId!==ticket.customerId)throw Error('The shop has not saved a customer report card for this visit yet.');
 const photos=[];for(const id of saved.photoIds){const p=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PET_PHOTO:'+id}}}))?.value as any;if(!p||p.ticketId!==ticketId)continue;const file=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PET_PHOTO_FILE:'+id}}}))?.value as any;if(file?.data)photos.push({id:p.id,stage:p.stage,date:p.date,caption:p.caption,mime:p.mime,data:file.data});}
 return {ticket,saved,photos};
}
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function customerReportCardHtml({ticket,saved,photos}:any){return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Grooming report card</title><style>body{font:17px system-ui,sans-serif;color:#18334c;max-width:1000px;margin:24px auto;padding:16px}article{white-space:pre-wrap;border-block:1px solid #cad4df;padding:20px 0}.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:0}img{width:100%;height:300px;object-fit:contain;background:#f3f5f7}figcaption{padding:8px 0}@media print{button{display:none}figure{break-inside:avoid}}</style></head><body><button onclick="window.print()">Print report card</button><h1>'+escape(ticket.tenant.name)+'</h1><h2>Grooming report card · #'+escape(ticket.orderNumber)+'</h2><p>'+escape(ticket.pets.map((v:any)=>v.pet.name).join(', '))+'</p><article>'+escape(saved.body)+'</article><div class="photos">'+photos.map((p:any)=>'<figure><img alt="'+escape(p.caption||p.stage)+'" src="data:'+escape(p.mime)+';base64,'+p.data+'"><figcaption><strong>'+escape(p.date)+' · '+escape(p.stage==='BEFORE'?'Before grooming':p.stage==='AFTER'?'After grooming':'Photo')+'</strong><p>'+escape(p.caption)+'</p></figcaption></figure>').join('')+'</div></body></html>';}
