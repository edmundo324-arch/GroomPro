import {readPublicHintSettings} from '@/src/lib/public-hint-settings';
import {readReferralPolicy,referralInvitation,referralShare,claimPortalReferral} from '@/src/lib/referral-policy';
import {readPortalBranding} from '@/src/lib/portal-branding';
import {customerReportCardKey,readCustomerReportCard,customerReportCardHtml} from '@/src/lib/customer-report-card';
import {listPetDocuments,readPetDocument,savePetDocument} from '@/src/lib/pet-documents';
import {joinWaitlist,readWaitlist,changeWaitlist} from '@/src/lib/waitlist';
import {bookingDraftChoices} from '@/src/lib/portal-booking-draft';
import {recordBookingActivity,latestBookingDraft} from '@/src/lib/unfinished-bookings';
import {readPortalMessagePreferences,savePortalMessagePreferences} from '@/src/lib/portal-message-preferences';
import {attendanceKey,attendanceFor,updateCustomerAttendance} from '@/src/lib/customer-attendance';
import {calendarInvitation} from '@/src/lib/calendar-invitation';
import {onlineStartAllowed} from '@/src/lib/online-booking-time';
import {isFeatureEnabled} from '@/src/lib/feature-access';
import {createTicket} from '@/src/lib/actions/ticket-booking';
import {portalSelections,portalAvailability} from '@/src/lib/portal-availability';
import {localToInstant,zonedParts} from '@/src/lib/operating-hours';
import {agreementRevision} from '@/src/lib/customer-agreement-pdf';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {startPhoneVerification,verifyAgreementPhone,readAccess,isAgreementToken,validTenant,readableAgreement,agreementProfile,updateAgreementProfile,requireAgreementLocation,revokePortalAccess,readAgreementConfig,issueAgreement,agreementPicturePath,getAgreementPhoto} from '@/src/lib/customer-agreement-store';
import {readPortalPolicy} from '@/src/lib/portal-policy-store';
import {getTenantNumberSetting} from '@/src/lib/customer-account';
import {cancellationWarning,cancellationTiming} from '@/src/lib/cancellation-policy';
import {requestCancellation,cancellationKey} from '@/src/lib/portal-requests';
import {sharingKey,sharingScope,sharedLocations,type SharingConfig} from '@/src/lib/customer-sharing-context';
import {parseAgreementPdf} from '@/src/lib/customer-agreement-signing';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers});
export async function POST(r:NextRequest){
 try{
  const raw=await r.text();if(raw.length>7_010_000)return reply({error:'This update is too large. Send a shorter message.'},400);
  const b=JSON.parse(raw),tenantId=b.tenant;if(b.action!=='uploadPetDocument'&&raw.length>260000)return reply({error:'This update is too large. Send a shorter message.'},400);
  if(!validTenant(tenantId)||await platformRestriction(tenantId))return reply({error:'This customer portal is unavailable. Contact the shop.'},404);
  if(b.action==='branding'){await requireAgreementLocation(tenantId,b.location);const business=await db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});return reply({business:business.name,...await readPortalBranding(tenantId),hints:await readPublicHintSettings(db,tenantId)});}
  if(b.action==='sendCode')return reply({token:await startPhoneVerification(tenantId,String(b.phone||''),undefined,b.location,'portal')});
  if(!isAgreementToken(b.token))return reply({error:'Sign in with your mobile number first.'},401);
  const state=await readAccess(db,tenantId,b.token);
  if(!state.portal||state.channel!=='online')return reply({error:'Sign in to the customer portal with your mobile number.'},401);
  if(b.action==='signOut'){await revokePortalAccess(tenantId,b.token);return reply({signedOut:true});}
  const locationId=await requireAgreementLocation(tenantId,state.locationId);
  const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:sharingKey}}}),sharing=row?.value as SharingConfig|undefined;
  if(sharing?.enabled&&!sharedLocations(sharing,locationId).length)return reply({error:'Ask the shop for a new portal link.'},403);
  const run=async()=>{
   if(b.action==='verifyCode')return await verifyAgreementPhone(tenantId,b.token,String(b.code||''))?reply({verified:true}):reply({error:'That code is incorrect or expired. Check the text or request a new code.'},400);
   readableAgreement(state);
   if(!state.phone||state.proof)return reply({error:'Verify your mobile number first.'},401);
   if(b.action==='edit'){if(typeof b.expectedRevision!=='string')return reply({error:'Refresh your profile before editing.'},409);const profile=await updateAgreementProfile(tenantId,b.token,b.fields||{},undefined,b.expectedRevision);return reply({profile,revision:agreementRevision(profile,state.terms,state.quote)});}
   const profile=await agreementProfile(db,tenantId,state);
   if(b.action==='view'){
    const [policy,business,feeCents,appointments,documents,agreementConfig]=await Promise.all([
     readPortalPolicy(tenantId),db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}}),getTenantNumberSetting(tenantId,'NO_SHOW_FEE_CENTS',4500),
     profile.id?db.ticket.findMany({where:{tenantId,customerId:profile.id},orderBy:{scheduledStart:'desc'},take:100,select:{id:true,orderNumber:true,scheduledStart:true,status:true,bookingDecision:true,location:{select:{name:true,timezone:true}},pets:{select:{pet:{select:{name:true}}}}}}):[],
     profile.id?db.$queryRaw<any[]>`SELECT id,title,signedAt FROM SignedDocument WHERE tenantId=${tenantId} AND customerId=${profile.id} AND documentContent LIKE 'GROOMPRO_PDF_V1:%' ORDER BY signedAt DESC`:[],readAgreementConfig(tenantId)
    ]);
    const [services,packages]=await Promise.all([db.service.findMany({where:{tenantId,active:true,id:{in:policy.bookableItems.filter(k=>k.startsWith('SERVICE:')).map(k=>k.slice(8))}},select:{id:true,name:true,description:true}}),db.package.findMany({where:{tenantId,active:true,id:{in:policy.bookableItems.filter(k=>k.startsWith('PACKAGE:')).map(k=>k.slice(8))}},select:{id:true,name:true,description:true}})]);
    const requests=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:appointments.flatMap(a=>[cancellationKey(a.id),attendanceKey(a.id),customerReportCardKey(a.id)])}},select:{settingKey:true,value:true}});
    const bookingDraft=profile.id?await latestBookingDraft(tenantId,profile.id,locationId,profile.pets.map(p=>p.id)):null;
    const waitlist=profile.id?(await readWaitlist(tenantId,profile.id,locationId)).map(v=>({id:v.id,revision:v.revision,from:v.from,through:v.through,state:v.state})):[];
    const referral=await readReferralPolicy(tenantId);const invitation=profile.id&&referral.policy.enabled&&referral.policy.portalInvitation?{...referralInvitation(referral.policy,business.name),code:await referralShare(tenantId,profile.id)}:null;
    return reply({referralInvitation:invitation,waitlist,bookingDraft,intakeAvailable:agreementConfig.channels.includes('online')&&agreementConfig.intake.clauses.length>0&&!!agreementConfig.shopEmail,profile,revision:agreementRevision(profile,state.terms,state.quote),business:business.name,approval:policy.approval,catalog:[...services.map(s=>({...s,key:'SERVICE:'+s.id})),...packages.map(p=>({...p,key:'PACKAGE:'+p.id}))],feeCents,warning:cancellationWarning(policy,business.name,feeCents),appointments:appointments.map(a=>({...a,hasReportCard:requests.some(q=>q.settingKey===customerReportCardKey(a.id)),attendance:attendanceFor(requests.find(q=>q.settingKey===attendanceKey(a.id))?.value,a.scheduledStart),late:a.scheduledStart?cancellationTiming(a.scheduledStart,new Date(),policy.notice).late:false,cancellationRequest:requests.find(q=>q.settingKey===cancellationKey(a.id))?.value||null})),documents});
   }
   if(!profile.id)return reply({error:'Complete your name and contact details first.'},400);
   if(b.action==='reportCard')return reply({html:customerReportCardHtml(await readCustomerReportCard(tenantId,String(b.ticketId||''),profile.id))});
   if(b.action==='petDocuments')return reply({documents:await listPetDocuments(tenantId,String(b.petId||''),profile.id)});
   if(b.action==='uploadPetDocument')return reply({document:await savePetDocument(tenantId,String(b.petId||''),b,profile.id)});
   if(b.action==='downloadPetDocument'){const v=await readPetDocument(tenantId,String(b.documentId||''),profile.id);return new NextResponse(new Uint8Array(Buffer.from(v.data,'base64')),{headers:{...headers,'Content-Type':v.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(v.name),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});}
   if(b.action==='joinWaitlist'){if(!await isFeatureEnabled(tenantId,'ONLINE_BOOKING'))return reply({error:'Online booking is unavailable.'},403);return reply({entry:await joinWaitlist(tenantId,profile.id,locationId,b)});}
   if(b.action==='leaveWaitlist')return reply({entry:await changeWaitlist(tenantId,profile.id,String(b.id||''),b.revision,'WITHDRAW')});
   if(b.action==='bookingActivity'){if(!await isFeatureEnabled(tenantId,'ONLINE_BOOKING'))return reply({error:'Online booking is unavailable.'},403);const choices=b.choices===undefined?undefined:bookingDraftChoices(b.choices,profile.pets.map(p=>p.id));const recorded=await recordBookingActivity(tenantId,profile.id,locationId,String(b.attemptId||''),false,b.stage,choices,b.revision);return reply({recorded:true,...recorded});}
   if(b.action==='messagePreferences')return reply({preferences:await readPortalMessagePreferences(tenantId,profile.id)});
   if(b.action==='saveMessagePreferences')return reply({preferences:await savePortalMessagePreferences(tenantId,profile.id,b.preferences)});
   if(b.action==='attendance')return reply({attendance:await updateCustomerAttendance(tenantId,profile.id,String(b.ticketId||''),{revision:b.revision,scheduledStart:b.scheduledStart,confirm:b.confirm===true,reminders:b.reminders})});
   if(b.action==='calendar'){
    const ticket=await db.ticket.findFirst({where:{tenantId,id:String(b.ticketId||''),customerId:profile.id,status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED']},bookingDecision:{notIn:['REQUESTED','PENDING']}},include:{tenant:{select:{name:true}},location:true}});
    if(!ticket?.scheduledStart)return reply({error:'This appointment is not confirmed or is no longer available. Refresh your appointments or contact the shop.'},404);
    const address=[ticket.location.address1,ticket.location.address2,ticket.location.city,ticket.location.state,ticket.location.postalCode].filter(Boolean).join(', ');
    return new NextResponse(calendarInvitation({...ticket,scheduledStart:ticket.scheduledStart},ticket.tenant.name,address),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="grooming-appointment.ics"'}});
   }
   if(b.action==='intake'){
    const intakeToken=await issueAgreement(tenantId,'intake','online',profile.id,[],undefined,locationId);
    return reply({url:'/customer-forms?tenant='+encodeURIComponent(tenantId)+'&location='+encodeURIComponent(locationId)+'#'+intakeToken});
   }
   if(b.action==='photo'){
    const pet=profile.pets.find(p=>p.id===b.petId);
    if(!pet||pet.pictureUrl!==agreementPicturePath(tenantId,pet.id))return reply({error:'Photo not found.'},404);
    const image=await getAgreementPhoto(tenantId,pet.id);
    return image?reply({photo:'data:image/jpeg;base64,'+image.toString('base64')}):reply({error:'Photo not found.'},404);
   }
   if(b.action==='slots'||b.action==='book'){
    if(b.action==='book'&&b.referralCode)await claimPortalReferral(tenantId,profile.id,String(b.referralCode));
    if(!await isFeatureEnabled(tenantId,'ONLINE_BOOKING')||!await isFeatureEnabled(tenantId,'TICKETS'))return reply({error:'Online booking is unavailable. Contact the shop to book your appointment.'},403);
    const selections=b.selections===undefined?[{petId:String(b.petId||''),itemKey:String(b.itemKey||'')}]:b.selections;
    const selection=await portalSelections(tenantId,locationId,profile.id,selections);
    if(b.action==='slots'){
     const date=String(b.date||''),available=await portalAvailability(tenantId,locationId,date,selection.duration,selection.serviceType,db,profile.id,selection.requiredClasses);
     const slots:Array<{start:string;resourceKey:string;name:string}>=[];
     for(let minute=0;minute<1440;minute+=selection.policy.slotIntervalMinutes){
      let start:Date;try{start=localToInstant(date+'T'+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),available.zone)}catch{continue;}
      if(!onlineStartAllowed(start,available.zone,selection.policy))continue;
      for(const resource of available.available(start,profile.id))slots.push({start:start.toISOString(),resourceKey:resource.kind+':'+resource.id,name:resource.name});
     }
     return reply({slots,timezone:available.zone,durationMin:selection.duration,subtotalCents:selection.lines.reduce((sum:number,line:any)=>sum+line.totalCents,0)});
    }
    const completedChoices=b.attemptId?bookingDraftChoices({selections,date:b.date,preferredStart:b.start},profile.pets.map(p=>p.id)):undefined;
    if(b.attemptId&&!/^[a-f0-9-]{36}$/i.test(String(b.attemptId)))return reply({error:'Refresh the booking form before continuing.'},400);
    const response=await createTicket(new NextRequest(new URL('/api/tickets',r.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:profile.id,petIds:selection.petIds,lines:selection.inputs,scheduledStart:b.start,bookingSource:'ONLINE'})}),{tenantId,locationId,customerId:profile.id,selections,resourceKey:String(b.resourceKey||''),requestId:String(b.requestId||''),durationMin:b.durationMin,subtotalCents:b.subtotalCents});
    const result=await response.json();if(!response.ok)return reply({error:result.error||'That appointment could not be booked. Choose another time.'},response.status);
    // The appointment is already saved. A follow-up tracking failure must not tell the customer that booking failed.
    if(b.attemptId)try{await recordBookingActivity(tenantId,profile.id,locationId,String(b.attemptId),true,'TIME_SELECTED',completedChoices,undefined,result.ticket.id)}catch{console.error('GroomPro: saved booking follow-up tracking could not be completed.');}
    return reply({appointment:{id:result.ticket.id,orderNumber:result.ticket.orderNumber,status:result.ticket.status,bookingDecision:result.ticket.bookingDecision}});
   }
   if(b.action==='cancel'){
    const currentFee=await getTenantNumberSetting(tenantId,'NO_SHOW_FEE_CENTS',4500);
    if(b.feeCents!==currentFee)return reply({error:'The cancellation fee changed. Refresh your appointments to review the current amount before submitting.'},409);
    return reply({request:await requestCancellation(tenantId,profile.id,String(b.ticketId||''),String(b.reason||''),b.acknowledged===true,b.feeCents,b.warning,typeof b.previousCancellationId==='string'?b.previousCancellationId:undefined)});
   }
   if(b.action==='change'){
    const message=String(b.reason||'').trim();if(!message||message.length>2000)return reply({error:'Tell the shop which date or time you would prefer, using up to 2,000 characters.'},400);
    await db.$transaction(async tx=>{
     await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${String(b.ticketId||'')} AND tenantId=${tenantId} AND customerId=${profile.id} FOR UPDATE`;
     const ticket=await tx.ticket.findFirst({where:{tenantId,id:String(b.ticketId||''),customerId:profile.id,status:{in:['OPEN','CONFIRMED']},checkedInAt:null}});
     if(!ticket)throw Error('Appointment unavailable.');
     const settingKey='PORTAL_CHANGE:'+ticket.id,where={tenantId_settingKey:{tenantId,settingKey}};
     const old=await tx.tenantSetting.findUnique({where});
     if((old?.value as any)?.state==='PENDING')return;
     const value={state:'PENDING',requestedAt:new Date().toISOString(),message};
     await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
     await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticket.id,customerId:profile.id,action:'CUSTOMER_CHANGE_REQUEST',summary:'Customer requested an appointment change; existing booking retained.',details:value}});
    });return reply({requested:true});
   }
   if(b.action==='document'){
    const [doc]=await db.$queryRaw<{documentContent:string|null}[]>`SELECT documentContent FROM SignedDocument WHERE tenantId=${tenantId} AND customerId=${profile.id} AND id=${String(b.documentId||'')}`;
    const pdf=doc?.documentContent&&parseAgreementPdf(doc.documentContent);
    return pdf?new NextResponse(new Uint8Array(Buffer.from(pdf,'base64')),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="signed-agreement.pdf"'}}):reply({error:'That signed agreement could not be found.'},404);
   }
   return reply({error:'Choose a customer portal action.'},400);
  };
  return await(sharing?.enabled?sharingScope.run({tenantId,locationId,locations:sharedLocations(sharing,locationId)},run):run());
 }catch(e){const message=e instanceof Error?e.message:'';return reply({error:e instanceof Error&&['AgreementError','PortalError'].includes(e.name)?message:'We could not complete this request. Refresh the portal and try again, or contact the shop.'},400);}
}
