import {createHash} from 'node:crypto';
import {db} from './db';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {birthdayDue} from './birthday-messages';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
import {configFor,sendCustomerSms} from './sms';
import {customerEmailConfig,sendCustomerEmail} from './customer-email';
import {normalizePhone} from './customer';
import {renderAppointmentMessage} from './appointment-message-plan';
export type BirthdayCursor={tenantId:string;customerId:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const birthdayMessageId=(tenantId:string,kind:string,id:string,year:number,channel:string)=>'birthday_'+createHash('sha256').update(JSON.stringify([tenantId,kind,id,year,channel])).digest('hex');
export async function runBirthdayMessages(cursor:BirthdayCursor|null=null){
 const began=Date.now(),tenant=await db.tenant.findFirst({where:cursor?.customerId?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});if(!tenant)return {cursor:null};const tenantId=tenant.id,next={tenantId,customerId:''},settings=await readAppointmentMessageSettings(tenantId),policy=settings.policy;
 if(!policy.enabled||(!policy.birthdays.customers&&!policy.birthdays.pets)||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))return {cursor:next};
 const locations=await db.location.findMany({where:{tenantId},select:{id:true,name:true,timezone:true}}),rows=await db.customer.findMany({where:{tenantId,active:true,...(cursor?.customerId?{id:{gt:cursor.customerId}}:{}),OR:[{dateOfBirth:{not:null}},{pets:{some:{tenantId,active:true,dateOfBirth:{not:null}}}}]},select:{id:true},orderBy:{id:'asc'},take:50});let last=cursor?.customerId||'',problem='';
 const load=(id:string)=>db.customer.findFirst({where:{tenantId,id,active:true},include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}},pets:{where:{tenantId,active:true,dateOfBirth:{not:null}}}}});
 for(const row of rows){if(last&&Date.now()-began>45000)return {cursor:{tenantId,customerId:last}};
 try{const customer=await load(row.id);if(!customer){last=row.id;continue;}const home=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}}),homeId=(home?.value as any)?.locationId,location=locations.find(l=>l.id===homeId)||(locations.length===1?locations[0]:undefined);
 if(!location){problem='Assign a home shop to customers with birthdays so GroomPro can use the correct send time.';last=row.id;continue;}
 const subjects=[...(policy.birthdays.customers?[{kind:'CUSTOMER',id:customer.id,dateOfBirth:customer.dateOfBirth,name:''}]:[]),...(policy.birthdays.pets?customer.pets.map(p=>({kind:'PET',id:p.id,dateOfBirth:p.dateOfBirth,name:p.name})):[])];
 for(const subject of subjects){const year=birthdayDue(subject.dateOfBirth,policy.birthdays,location.timezone,new Date());if(year===null)continue;
 for(const channel of policy.channels){const id=birthdayMessageId(tenantId,subject.kind,subject.id,year,channel);if(await db.communication.findFirst({where:{tenantId,id}}))continue;
 const fresh=await load(customer.id),latest=await readAppointmentMessageSettings(tenantId);if(!fresh||latest.revision!==settings.revision||!latest.policy.enabled||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))continue;
 const person=subject.kind==='PET'?fresh.pets.find(p=>p.id===subject.id):fresh;if(!person||birthdayDue(person.dateOfBirth,latest.policy.birthdays,location.timezone,new Date())!==year)continue;
 const body=renderAppointmentMessage(subject.kind==='PET'?policy.birthdays.petText:policy.birthdays.customerText,{business:tenant.name,firstName:fresh.firstName||'',location:location.name,customer:[fresh.firstName,fresh.lastName].filter(Boolean).join(' '),pet:subject.kind==='PET'?(person as {name:string}).name:''});let result;
 if(channel==='SMS'){if(fresh.appointmentSms===false||fresh.invalidSmsNumber)continue;const phone=fresh.phones[0];if(!phone||!(await configFor(tenantId))||!await isFeatureEnabled(tenantId,customerContactFeature)){problem='Some birthday wishes need a texting-enabled number or completed texting setup.';continue;}const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;result=await sendCustomerSms({tenantId,customerId:fresh.id,phoneId:phone.id,subject:'Birthday wishes',body,operation:{id,expectedPhone:to}});
 }else{if(fresh.appointmentEmail===false||fresh.invalidEmail)continue;if(!fresh.email||!(await customerEmailConfig(tenantId))){problem='Some birthday wishes need a customer email address or completed email setup.';continue;}result=await sendCustomerEmail({tenantId,customerId:fresh.id,body,appointmentMessage:true,document:{id,subject:'Birthday wishes',expectedEmail:fresh.email,html:'<p>'+escape(body).replace(/\n/g,'<br>')+'</p>'}});}
 if(['UNKNOWN','FAILED','SENDING'].includes(result.communication.deliveryStatus))problem='Review Communication History for birthday messages whose delivery failed or could not be confirmed. Uncertain copies are not resent automatically.';
 }}
 }catch{problem='A birthday message needs review. Check the saved birthday, customer shop and message setup.';}last=row.id;
 }
 const value={checkedAt:new Date().toISOString(),message:problem||'Birthdays checked. Customer Communication History shows recorded birthday wishes.'};await db.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:'BIRTHDAY_MESSAGE_RUNTIME'}},create:{tenantId,settingKey:'BIRTHDAY_MESSAGE_RUNTIME',value},update:{value}});return {cursor:rows.length===50?{tenantId,customerId:last}:next};
}
