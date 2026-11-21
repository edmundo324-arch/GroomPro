import {db} from './db';
export const noShowOperationKey=(ticketId:string)=>'NO_SHOW_OPERATION:'+ticketId;
// Reserve before any external charge. A simultaneous void must not invalidate
// a ticket while a fee is being charged. An interrupted charge needs review.
export async function beginNoShowOperation(tenantId:string,ticketId:string,client:any=db){return client.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const t=await tx.ticket.findFirst({where:{id:ticketId,tenantId}});if(!t)throw Error('Ticket could not be found.');if(t.noShowFeeProcessedAt)return false;if(['CLOSED','CANCELLED'].includes(t.status))throw Error('This ticket is closed, cancelled or voided and cannot receive a no-show fee.');
 const where={tenantId_settingKey:{tenantId,settingKey:noShowOperationKey(ticketId)}},old=(await tx.tenantSetting.findUnique({where}))?.value;if(old?.state==='RUNNING')throw Error('A no-show fee is processing or needs verification. Review payment and account history before trying again.');
 const value={state:'RUNNING',startedAt:new Date().toISOString()};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:noShowOperationKey(ticketId),value},update:{value}});return true;
 });}
export async function finishNoShowOperation(tenantId:string,ticketId:string,state='DONE',client:any=db){await client.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:noShowOperationKey(ticketId)}},data:{value:{state,completedAt:new Date().toISOString()}}});}
