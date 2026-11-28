import {createHash} from 'node:crypto';
import {db} from './db';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {readPortalPolicy} from './portal-policy-store';
import {vaccinationReminderDue} from './vaccination-reminders';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
import {configFor,sendCustomerSms} from './sms';
import {customerEmailConfig,sendCustomerEmail} from './customer-email';
import {normalizePhone} from './customer';
import {renderAppointmentMessage} from './appointment-message-plan';
export type VaccinationCursor={tenantId:string;vaccinationId:string};
export const vaccinationRuntimeKey='VACCINATION_MESSAGE_RUNTIME';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function vaccinationMessageId(tenantId:string,petId:string,vaccine:string,expiry:string,customerId:string,channel:string){return 'vax_'+createHash('sha256').update(JSON.stringify([tenantId,petId,vaccine.trim().toLocaleLowerCase(),expiry,customerId,channel])).digest('hex');}
export async function runVaccinationReminders(cursor:VaccinationCursor|null=null){
 const began=Date.now(),now=new Date(),tenant=await db.tenant.findFirst({where:cursor?.vaccinationId?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});if(!tenant)return {cursor:null};const tenantId=tenant.id,next={tenantId,vaccinationId:''};
 const status=async(message:string)=>{const value={checkedAt:new Date().toISOString(),message},where={tenantId_settingKey:{tenantId,settingKey:vaccinationRuntimeKey}};await db.tenantSetting.upsert({where,create:{tenantId,settingKey:vaccinationRuntimeKey,value},update:{value}});};
 const settings=await readAppointmentMessageSettings(tenantId),policy=settings.policy;
 if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING')||!policy.enabled||!policy.vaccinations.enabled){await status('Vaccination reminders are off or unavailable for this business.');return {cursor:next};}
 if(!policy.publicOrigin){await status('Save the customer website address before sending vaccination reminder links.');return {cursor:next};}
 const locations=await db.location.findMany({where:{tenantId},select:{id:true,name:true,timezone:true}}),required=(await readPortalPolicy(tenantId)).vaccinations.names;
 const rows=await db.vaccination.findMany({where:{tenantId,...(cursor?.vaccinationId?{id:{gt:cursor.vaccinationId}}:{}),expiresAt:{gte:new Date(+now-2*86400000),lte:new Date(+now+(policy.vaccinations.weeks*7+2)*86400000)},pet:{active:true,customer:{active:true}}},select:{id:true},orderBy:{id:'asc'},take:50});
 let last=cursor?.vaccinationId||'',problem='';
 const load=(id:string)=>db.vaccination.findFirst({where:{id,tenantId,pet:{active:true,customer:{active:true}}},include:{pet:{include:{vaccinations:{where:{tenantId}},customer:{include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}}}}}});
 for(const row of rows){if(last&&Date.now()-began>45000){await status(problem||'Checking vaccination expiration dates.');return {cursor:{tenantId,vaccinationId:last}};}
 try{const record=await load(row.id);if(!record){last=row.id;continue;}const customer=record.pet.customer,home=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}}),homeId=(home?.value as any)?.locationId;const location=locations.find(l=>l.id===homeId)||(locations.length===1?locations[0]:undefined);if(!location){problem='Some customers need a home shop assigned before GroomPro can use the correct time zone and portal link.';last=row.id;continue;}
 const due=vaccinationReminderDue(record,record.pet.vaccinations,required,policy.vaccinations,location.timezone,new Date());if(!due){last=row.id;continue;}
 const portal=new URL('/portal',policy.publicOrigin);portal.searchParams.set('tenant',tenantId);portal.searchParams.set('location',location.id);const body=renderAppointmentMessage(policy.vaccinations.text,{business:tenant.name,firstName:customer.firstName||'',location:location.name,customer:[customer.firstName,customer.lastName].filter(Boolean).join(' '),pet:record.pet.name,vaccine:record.vaccineName,expirationDate:new Date(due.expirationDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}),portalLink:portal.href});
 for(const channel of policy.channels){const id=vaccinationMessageId(tenantId,record.petId,record.vaccineName,due.expirationDate,customer.id,channel);if(await db.communication.findFirst({where:{id,tenantId}}))continue;
 const fresh=await load(row.id),latest=await readAppointmentMessageSettings(tenantId);if(!fresh||fresh.pet.customerId!==customer.id||latest.revision!==settings.revision||!latest.policy.enabled||!latest.policy.vaccinations.enabled||+new Date(fresh.expiresAt!)!==+new Date(record.expiresAt!)||fresh.vaccineName!==record.vaccineName||!vaccinationReminderDue(fresh,fresh.pet.vaccinations,required,latest.policy.vaccinations,location.timezone,new Date())||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))continue;
 let result;if(channel==='SMS'){if(fresh.pet.customer.appointmentSms===false||fresh.pet.customer.invalidSmsNumber)continue;const phone=fresh.pet.customer.phones[0];if(!phone||!(await configFor(tenantId))||!await isFeatureEnabled(tenantId,customerContactFeature)){problem='Some vaccination reminders need a texting-enabled customer number or completed texting setup.';continue;}const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;result=await sendCustomerSms({tenantId,customerId:customer.id,phoneId:phone.id,subject:'Vaccination record reminder',body,operation:{id,expectedPhone:to}});}else{if(fresh.pet.customer.appointmentEmail===false||fresh.pet.customer.invalidEmail)continue;const email=fresh.pet.customer.email;if(!email||!(await customerEmailConfig(tenantId))){problem='Some vaccination reminders need a customer email address or completed email setup.';continue;}result=await sendCustomerEmail({tenantId,customerId:customer.id,body,appointmentMessage:true,document:{id,subject:'Vaccination record reminder',expectedEmail:email,html:'<p>'+escape(body).replace(/\n/g,'<br>')+'</p>'}});}
 if(['UNKNOWN','FAILED','SENDING'].includes(result.communication.deliveryStatus))problem='Review Communication History for vaccination reminders whose delivery failed or could not be confirmed. Uncertain copies are not resent automatically.';
 }
 }catch{problem='A vaccination reminder needs review. Check the pet’s dates, customer shop and message setup.';}last=row.id;
 }
 await status(problem||'Vaccination records checked. Customer Communication History shows individual reminder results.');return {cursor:rows.length===50?{tenantId,vaccinationId:last}:next};
}
