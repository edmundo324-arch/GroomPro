import {createHash} from 'node:crypto';
export const standardRebookingRule='STANDARD_REBOOKING';
export async function conversationRule(client:any,tenantId:string,ruleId:string){
 if(ruleId!==standardRebookingRule)return (await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE:'+ruleId}}}))?.value;
 const saved=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'APPOINTMENT_MESSAGE_POLICY'}}}))?.value;
 return {id:ruleId,name:'Rebooking invitation',revision:saved?.revision||0,state:saved?.policy?.enabled&&saved?.policy?.rebookingEnabled?'ACTIVE':'OFF',event:'CUSTOMER_OVERDUE',conditions:{vip:'ANY',upcoming:'NO',attendance:'ANY',tagIds:[]},actions:[{kind:'MESSAGE',marketing:true}]};
}
export const conversationPrefix='CUSTOMER_OFFER_CONVERSATION:';
const offerPrefix=(customerId:string,ruleId:string)=>conversationPrefix+createHash('sha256').update(JSON.stringify([customerId,ruleId])).digest('hex')+':';
export const conversationLinkKey=(id:string)=>'CUSTOMER_OFFER_REPLY:'+id;
export async function queueOfferConversation(tx:any,tenantId:string,incoming:any,replyToId?:string){
 if(!incoming.customerId||!incoming.body||!['EMAIL','SMS'].includes(incoming.channel))return false;
 const original=await tx.communication.findFirst({where:{tenantId,customerId:incoming.customerId,direction:'OUTBOUND',channel:incoming.channel,...(replyToId?{id:replyToId}:{toAddress:incoming.fromAddress})},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 if(!original||!['QUEUED','SENT','DELIVERED','READ','ACCEPTED'].includes(original.deliveryStatus))return false;
 const linked=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:conversationLinkKey(original.id)}}}))?.value;
 const reference=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE_DELIVERY:'+original.id}}}))?.value;
 let settingKey=linked?.threadKey;
 if(!settingKey){
  if(!reference?.ruleId)return false;
  const rule=await conversationRule(tx,tenantId,reference.ruleId);
  if(!rule?.actions?.some((a:any)=>a.kind==='MESSAGE'&&(a.marketing||rule.event==='CUSTOMER_OVERDUE')))return false;
  settingKey=offerPrefix(incoming.customerId,reference.ruleId)+createHash('sha256').update(reference.eventId).digest('hex');
 }
 if(!settingKey.startsWith(conversationPrefix))return false;
 await tx.$queryRaw`SELECT id FROM Customer WHERE id=${incoming.customerId} AND tenantId=${tenantId} FOR UPDATE`;
 const where={tenantId_settingKey:{tenantId,settingKey}},previous=(await tx.tenantSetting.findUnique({where}))?.value;
 if(previous&&previous.customerId!==incoming.customerId)return false;
 if(previous?.incomingId===incoming.id)return true;
 if(previous?.incomingAt&&incoming.createdAt&&+new Date(previous.incomingAt)>+new Date(incoming.createdAt))return true;
 const value={...previous,customerId:incoming.customerId,ruleId:previous?.ruleId||reference.ruleId,ruleRevision:previous?.ruleRevision??reference?.revision,rootId:previous?.rootId||original.id,eventId:previous?.eventId||reference.eventId,incomingId:incoming.id,incomingAt:new Date(incoming.createdAt||Date.now()).toISOString(),channel:incoming.channel,fromAddress:incoming.fromAddress,revision:(previous?.revision||0)+1,state:'PENDING',updatedAt:new Date().toISOString(),lastError:null};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});return true;
}
// The active pause belongs to this customer and offer rule only. Inbox handling and other offers continue.
export async function offerConversationPaused(client:any,tenantId:string,customerId:string,ruleId:string){
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:offerPrefix(customerId,ruleId)}},select:{value:true}});
 return rows.some((r:any)=>r.value?.customerId===customerId&&r.value.ruleId===ruleId&&['PENDING','PAUSED','STOPPED','REVIEW'].includes(r.value.state));
}
export async function offerConversationContext(client:any,tenantId:string,state:any){
 const customer=await client.customer.findFirst({where:{tenantId,id:state.customerId,active:true},include:{phones:true,pets:{where:{active:true},select:{id:true,name:true}}}});
 if(!customer)return null;
 const [root,incoming,recent,ruleRow,home]=await Promise.all([
  client.communication.findFirst({where:{tenantId,id:state.rootId,customerId:customer.id,direction:'OUTBOUND'}}),
  client.communication.findFirst({where:{tenantId,id:state.incomingId,customerId:customer.id,direction:'INBOUND'}}),
  client.communication.findMany({where:{tenantId,customerId:customer.id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:40,select:{id:true,direction:true,channel:true,body:true,createdAt:true}}),
  conversationRule(client,tenantId,state.ruleId),
  client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}})]);
 if(!root||!incoming)return null;
 const locations=await client.location.findMany({where:{tenantId,...(home?.value?.locationId?{id:home.value.locationId}:{})},take:2,select:{id:true,name:true,timezone:true}});
 if(locations.length!==1)return null;
 return {customer,root,incoming,rule:ruleRow,location:locations[0],history:recent.reverse().map((m:any)=>({id:m.id,speaker:m.direction==='INBOUND'?'customer':'shop',channel:m.channel,text:m.body,date:new Date(m.createdAt).toISOString()}))};
}
