import {offerConversationPaused} from './customer-conversations';
import {ruleMessageAttempt} from './custom-rule-retry';
import {currentTargetNames,type PetTarget} from './custom-rule-pet-targets';
import {rememberRuleDelivery} from './custom-rule-history';
import {db} from './db';
import {renderCustomRuleText,type CustomRuleAction,type customRuleVariables} from './custom-rule-policy';
import {claimRuleMessage,ruleActionId} from './custom-rule-staff-actions';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
import {configFor,sendCustomerSms} from './sms';
import {customerEmailConfig,sendCustomerEmail} from './customer-email';
import {normalizePhone} from './phone-normalization';
import {reserveMarketingMessage} from './marketing-limit';
const html=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function sendCustomRuleMessage(tenantId:string,rule:{id:string;revision:number;conditions?:PetTarget},action:CustomRuleAction,eventId:string,customerId:string,values:Partial<Record<typeof customRuleVariables[number],string>>,stillCurrent:()=>Promise<boolean>,client:any=db){
 if(action.kind!=='MESSAGE')throw Error('Choose a customer message action.');
 const results:string[]=[];
 for(const channel of action.channels){
  const baseId='rule_'+ruleActionId(tenantId,rule.id,eventId,action.id,channel),id=await ruleMessageAttempt(client,tenantId,baseId,customerId,rule);if(!id)continue;
  if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING')||!await stillCurrent())continue;
  const customer=await client.customer.findFirst({where:{tenantId,id:customerId,active:true},include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}});if(!customer)continue;
  const names=await currentTargetNames(client,tenantId,customerId,rule);if(names===null)continue;
  const currentValues={...values,...(names!==undefined?{petName:names}:{}),customerName:[customer.firstName,customer.lastName].filter(Boolean).join(' '),balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(customer.balanceCents)/100)},body=renderCustomRuleText(action.body,currentValues),subject=renderCustomRuleText(action.title,currentValues);
  const phone=customer.phones?.[0];
  if(channel==='SMS'&&(customer.appointmentSms===false||customer.invalidSmsNumber||!phone))continue;
  if(channel==='EMAIL'&&(customer.appointmentEmail===false||customer.invalidEmail||!customer.email))continue;
  if(channel==='SMS'&&(!(await configFor(tenantId))||!await isFeatureEnabled(tenantId,customerContactFeature)))throw Error('Finish customer texting setup before this rule can send texts.');
  if(channel==='EMAIL'&&!(await customerEmailConfig(tenantId)))throw Error('Finish customer email setup before this rule can send email.');
  if(channel==='SMS'&&body.length>1600)throw Error('Shorten this rule’s text message to 1,600 characters or fewer.');
  if(action.marketing&&await offerConversationPaused(client,tenantId,customerId,rule.id))continue;
  if(!await claimRuleMessage(client,tenantId,rule,eventId))continue;
  if(action.marketing&&!(await reserveMarketingMessage(client,tenantId,customerId,'rule-marketing:'+eventId)).allowed)continue;
  await rememberRuleDelivery(client,tenantId,rule,eventId,id,customerId,channel);
  let result;
  if(channel==='SMS'){const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;result=await sendCustomerSms({tenantId,customerId,phoneId:phone.id,subject,body,operation:{id,expectedPhone:to}});}
  else result=await sendCustomerEmail({tenantId,customerId,body,appointmentMessage:true,document:{id,subject,expectedEmail:customer.email,html:'<p>'+html(body).replace(/\n/g,'<br>')+'</p>'}});
  results.push(result.communication.deliveryStatus);
 }return results;
}
