// Run once during deployment, before the server and message scheduler start.
const version='20261120_online_acceptance_v1';
const {createHash}=require('node:crypto');
const checksum=createHash('sha256').update(version).digest('hex');
async function correctOnlineAcceptance(db,now=new Date()){
 return db.$transaction(async tx=>{
  const applied=await tx.$queryRaw`SELECT checksum FROM GroomProSchemaVersion WHERE version=${version}`;
  if(applied.length){if(applied[0].checksum!==checksum)throw Error('Online acceptance correction checksum mismatch.');return 0;}
  const tickets=await tx.ticket.findMany({where:{bookingSource:'ONLINE',bookingDecision:'ACCEPTED',status:'CONFIRMED',displayStatus:null,closedAt:null,scheduledStart:{gt:now}},select:{id:true,tenantId:true,customerId:true,scheduledStart:true}});
  let count=0;
  for(const ticket of tickets){
   await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${ticket.tenantId} FOR UPDATE`;
   const current=await tx.ticket.findFirst({where:{id:ticket.id,tenantId:ticket.tenantId,bookingSource:'ONLINE',bookingDecision:'ACCEPTED',status:'CONFIRMED',displayStatus:null,closedAt:null,scheduledStart:{gt:now}}});
   if(!current)continue;
   const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:ticket.tenantId,settingKey:'CUSTOMER_ATTENDANCE:'+ticket.id}}});
   const state=row?.value;
   if(state?.confirmedAt&&state.scheduledStart&&+new Date(state.scheduledStart)===+current.scheduledStart)continue;
   const confirmations=await tx.auditEntry.findMany({where:{tenantId:ticket.tenantId,entityType:'TICKET',entityId:ticket.id,action:{in:['CUSTOMER_ATTENDANCE_CONFIRMED','STATUS_CHANGE']}},select:{action:true,details:true}});
   if(confirmations.some(a=>a.action==='STATUS_CHANGE'&&a.details?.newStatus==='CONFIRMED'))continue;
   if(confirmations.some(a=>a.details?.confirmedAt&&a.details?.scheduledStart&&+new Date(a.details.scheduledStart)===+current.scheduledStart))continue;
   await tx.ticket.update({where:{id:ticket.id},data:{status:'OPEN'}});
   await tx.auditEntry.create({data:{tenantId:ticket.tenantId,customerId:ticket.customerId,entityType:'TICKET',entityId:ticket.id,actorType:'SYSTEM',action:'ONLINE_ACCEPTANCE_CORRECTED',summary:'Changed shop-accepted online booking to Accepted because customer confirmation was not recorded.',details:{migration:version,previousStatus:'CONFIRMED',status:'OPEN',scheduledStart:current.scheduledStart.toISOString()}}});
   count++;
  }
  await tx.$executeRaw`INSERT INTO GroomProSchemaVersion (version,checksum) VALUES (${version},${checksum})`;
  return count;
 },{timeout:240000});
}
module.exports={correctOnlineAcceptance};
