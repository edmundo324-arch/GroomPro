import {createHash} from 'node:crypto';
import {db} from './db';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {prepaidReminderDue} from './prepaid-reminders';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
import {configFor,sendCustomerSms} from './sms';
import {customerEmailConfig,sendCustomerEmail} from './customer-email';
import {normalizePhone} from './customer';
import {renderAppointmentMessage} from './appointment-message-plan';
export type PrepaidCursor={tenantId:string;entryKey:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const prepaidReminderId=(tenantId:string,p:any,reason:string,channel:string)=>'prepaid_'+createHash('sha256').update(JSON.stringify([tenantId,p.id,p.customerId,reason,reason==='EXPIRY'?p.expiresOn:'',channel])).digest('hex');
export async function runPrepaidReminders(cursor:PrepaidCursor|null=null){
 const began=Date.now(),tenant=await db.tenant.findFirst({where:cursor?.entryKey?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});if(!tenant)return {cursor:null};const tenantId=tenant.id,next={tenantId,entryKey:''};
 const settings=await readAppointmentMessageSettings(tenantId),policy=settings.policy;
 if(!policy.enabled||!policy.prepaid.enabled||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))return {cursor:next};
 const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:',...(cursor?.entryKey?{gt:cursor.entryKey}:{})}},orderBy:{settingKey:'asc'},take:50});let last=cursor?.entryKey||'',problem='';
 for(const row of rows){if(last&&Date.now()-began>45000)return {cursor:{tenantId,entryKey:last}};
  try{const p=row.value as any,location=await db.location.findFirst({where:{tenantId,id:p.locationId}});if(!location){last=row.settingKey;continue;}
  const reasons=prepaidReminderDue(p,policy.prepaid,location.timezone,new Date());if(!reasons){last=row.settingKey;continue;}
  const reason=reasons.includes('EXPIRY')?'EXPIRY':'BALANCE';
  for(const channel of policy.channels){const id=prepaidReminderId(tenantId,p,reason,channel);
   if(await db.communication.findFirst({where:{tenantId,id:{in:reason==='BALANCE'?[id,prepaidReminderId(tenantId,p,'EXPIRY',channel)]:[id]}}}))continue;
   const freshRow=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}),fresh=freshRow?.value as any,latest=await readAppointmentMessageSettings(tenantId);
   if(!fresh||fresh.customerId!==p.customerId||fresh.expiresOn!==p.expiresOn||latest.revision!==settings.revision||!latest.policy.enabled||!prepaidReminderDue(fresh,latest.policy.prepaid,location.timezone,new Date())?.includes(reason)||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))continue;
   const customer=await db.customer.findFirst({where:{tenantId,id:fresh.customerId,active:true},include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}});if(!customer)continue;
   const body=renderAppointmentMessage(fresh.expiresOn?policy.prepaid.text:policy.prepaid.text.replace(/\{expiration\}/g,''),{business:tenant.name,customer:[customer.firstName,customer.lastName].filter(Boolean).join(' '),package:fresh.offer.name,visits:String(fresh.visitsRemaining),expiration:fresh.expiresOn?' These visits expire on '+new Date(fresh.expiresOn+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'})+'.':''});
   if(channel==='SMS'){if(customer.appointmentSms===false||customer.invalidSmsNumber||!(await configFor(tenantId))||!await isFeatureEnabled(tenantId,customerContactFeature))continue;const phone=customer.phones[0];if(!phone)continue;const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;await sendCustomerSms({tenantId,customerId:customer.id,phoneId:phone.id,subject:'Prepaid package reminder',body,operation:{id,expectedPhone:to}});
   }else{if(customer.appointmentEmail===false||customer.invalidEmail||!customer.email||!(await customerEmailConfig(tenantId)))continue;await sendCustomerEmail({tenantId,customerId:customer.id,body,appointmentMessage:true,document:{id,subject:'Prepaid package reminder',expectedEmail:customer.email,html:'<p>'+escape(body).replace(/\n/g,'<br>')+'</p>'}});}
  }}catch{problem='A prepaid reminder needs review. Check the package, customer and message setup.';}last=row.settingKey;
 }
 const value={checkedAt:new Date().toISOString(),message:problem||'Prepaid packages checked. Customer Communication History shows recorded reminders.'};await db.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:'PREPAID_MESSAGE_RUNTIME'}},create:{tenantId,settingKey:'PREPAID_MESSAGE_RUNTIME',value},update:{value}});
 return {cursor:rows.length===50?{tenantId,entryKey:last}:next};
}
