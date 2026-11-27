import {deliveryMessage} from '@/src/lib/human-communication';
import {pickupCallAction,pickupContactAction,recordedPickupContact,pickupContactMethods} from '@/src/lib/pickup-call';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {deviceApproved,deviceApprovalCookie} from '@/src/lib/device-authorization';
import {businessCookie,deviceCookie,sessionCookie} from '@/src/lib/business-context';
import {currentBusinessSession} from '@/src/lib/platform-business';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {readAppointmentMessageSettings} from '@/src/lib/appointment-message-store';
import {smsConfigured} from '@/src/lib/sms';
import {isFeatureEnabled,customerContactFeature} from '@/src/lib/feature-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function context(r:NextRequest){
 const tenantId=r.cookies.get(businessCookie)?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',deviceId=r.cookies.get(deviceCookie)?.value||'',sid=r.cookies.get(sessionCookie)?.value||'';
 if(!tenantId||!deviceId||await platformRestriction(tenantId))return null;
 const session=sid?await currentBusinessSession(db,tenantId,sid,deviceId):null;
 if(!session&&!await deviceApproved(tenantId,deviceId,r.cookies.get(deviceApprovalCookie)?.value||''))return null;
 return {tenantId,deviceId,session,key:{tenantId,settingKey:'PICKUP_NOTICE_DEVICE:'+deviceId}};
}
export async function GET(r:NextRequest){
 const c=await context(r);if(!c)return reply({error:'Verify this device for the business before receiving pickup notices.'},401);
 const locations=await db.location.findMany({where:{tenantId:c.tenantId},select:{id:true,name:true,timezone:true}});
 const saved=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:c.key}}))?.value as any;
 // An approved but locked device may only read its saved shop (or the tenant's sole shop).
 const locationId=saved?.locationId||(locations.length===1?locations[0].id:'');
 const enabled=saved?.enabled!==false;
 if((!enabled&&r.nextUrl.searchParams.get('show')!=='1')||!locations.some(l=>l.id===locationId))return reply({enabled,locationId,locations,notices:[]});
 const settings=await readAppointmentMessageSettings(c.tenantId),policy=settings.policy;
 const texting=(await smsConfigured(c.tenantId))&&await isFeatureEnabled(c.tenantId,customerContactFeature);
 const tickets=await db.ticket.findMany({where:{tenantId:c.tenantId,locationId,status:'READY',pickupAt:{not:null},pickupCompletedAt:null},select:{id:true,orderNumber:true,pickupAt:true,pets:{select:{pet:{select:{name:true}}}},customer:{select:{active:true,appointmentSms:true,invalidSmsNumber:true,phones:{where:{smsEnabled:true},select:{id:true}}}}},orderBy:{pickupAt:'desc'},take:100});
 const notices=await Promise.all(tickets.map(async t=>{
  const dismissal=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:c.tenantId,settingKey:'PICKUP_NOTICE_DISMISSED:'+t.id}}}))?.value as any;
  if(dismissal?.readyAt===t.pickupAt?.toISOString()&&dismissal.locationId===locationId)return null;
  const called=await db.auditEntry.findFirst({where:{tenantId:c.tenantId,entityType:'TICKET',entityId:t.id,action:pickupCallAction,occurredAt:{gte:t.pickupAt!}},select:{id:true}});
  const contact=recordedPickupContact(await db.auditEntry.findFirst({where:{tenantId:c.tenantId,entityType:'TICKET',entityId:t.id,action:pickupContactAction,occurredAt:{gte:t.pickupAt!}},orderBy:{occurredAt:'desc'},select:{details:true,occurredAt:true}}));
  const sent=await db.communication.findFirst({where:{tenantId:c.tenantId,ticketId:t.id,subject:'Ready for pickup',channel:'SMS',createdAt:{gte:t.pickupAt!}},orderBy:{createdAt:'desc'},select:{deliveryStatus:true,sentAt:true}});
  const scheduledFor=new Date(+t.pickupAt!+policy.pickupDelayMinutes*60000).toISOString();
  const eligible=policy.enabled&&policy.pickupEnabled&&policy.channels.includes('SMS')&&!!settings.activeSince&&!!policy.publicOrigin&&texting&&t.customer.active&&t.customer.appointmentSms!==false&&!t.customer.invalidSmsNumber&&t.customer.phones.length>0;
  const cancellation=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:c.tenantId,settingKey:'PICKUP_TEXT_CANCELLED:'+t.id}}}))?.value as any;
  const cancelled=cancellation?.readyAt===t.pickupAt?.toISOString();
  const state=contact?'Customer Contacted — '+pickupContactMethods[contact.method]+' @ '+new Date(contact.contactedAt).toLocaleString('en-US',{timeZone:locations.find(l=>l.id===locationId)?.timezone||'UTC'}):called?'Customer Called':sent?deliveryMessage(sent.deliveryStatus):cancelled?'Queued pickup text cancelled':eligible?'Pickup text is queued; earliest send time: '+new Date(scheduledFor).toLocaleTimeString('en-US',{timeZone:locations.find(l=>l.id===locationId)?.timezone||'UTC',hour:'numeric',minute:'2-digit'}):'Review texting settings or the customer’s contact details before expecting an automatic pickup text.';
  return {ticketId:t.id,number:t.orderNumber,pets:t.pets.map(p=>p.pet.name).join(', '),readyAt:t.pickupAt,scheduledFor,state,cancelled,sent:!!sent,contacted:!!contact||!!called||!!sent?.sentAt};
 }));
 return reply({enabled,locationId,locations,notices:notices.filter(Boolean),snoozeMinutes:policy.pickupNoticeSnoozeMinutes??5});
}
export const PUT=withRequestPolicy(async(r:NextRequest)=>{
 const c=await context(r);if(!c?.session)return reply({error:'Employee PIN is required.'},401);
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(c.session.user.role))return reply({error:'Ask an owner or manager to change this device’s pickup notices.'},403);
 const b=await r.json();if(typeof b.enabled!=='boolean'||!await db.location.findFirst({where:{id:b.locationId,tenantId:c.tenantId}}))return reply({error:'Choose this device’s shop and whether it receives pickup notices.'},400);
 const value={enabled:b.enabled,locationId:b.locationId};await db.tenantSetting.upsert({where:{tenantId_settingKey:c.key},create:{...c.key,value},update:{value}});return reply(value);
},{configure:true});

export const POST=withRequestPolicy(async(r:NextRequest)=>{
 const c=await context(r);if(!c?.session)return reply({error:'Employee PIN is required.'},401);
 const b=await r.json();
 const saved=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:c.key}}))?.value as any;
 const locations=await db.location.findMany({where:{tenantId:c.tenantId},select:{id:true}});
 const locationId=saved?.locationId||(locations.length===1?locations[0].id:'');
 if(!locationId||b.locationId!==locationId)return reply({error:'Open the reminder at this device’s assigned shop.'},403);
 const t=await db.ticket.findFirst({where:{id:String(b.ticketId||''),tenantId:c.tenantId,locationId,status:'READY',pickupCompletedAt:null},select:{id:true,pickupAt:true}});
 if(!t?.pickupAt||t.pickupAt.toISOString()!==b.readyAt)return reply({error:'This reminder changed. Refresh before dismissing it.'},409);
 const key={tenantId:c.tenantId,settingKey:'PICKUP_NOTICE_DISMISSED:'+t.id},value={locationId,readyAt:b.readyAt,dismissedAt:new Date().toISOString(),userId:c.session.user.id};
 await db.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
 return reply({ok:true});
},{feature:'TICKETS'});
