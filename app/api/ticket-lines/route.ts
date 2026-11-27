import {attendanceDecisionDetails} from '@/src/lib/attendance-move';
import {ticketTiming} from '@/src/lib/line-time-store';
import {removeTicketLine} from '@/src/lib/remove-ticket-line';
import {getServicePrice} from '@/src/lib/pricing';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {ticketWorkspace} from '@/src/lib/pos-layout';
import {syncAppointmentPets} from '@/src/lib/appointment-pet-store';
import {ensureGroomingNotes} from '@/src/lib/grooming-notes-store';
import {removePetTicketItems} from '@/src/lib/pet-ticket-items-store';
import {readPlannedPackages,writePlannedPackages} from '@/src/lib/planned-package-store';
import {offlineLineId} from '@/src/lib/offline-transaction';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {setOfferTodayLine} from '@/src/lib/offer-today-lines';
import {approvedScheduling} from '@/src/lib/scheduling-authorization';
import {schedulingApproved,schedulingWarning,schedulingException,warningDetails} from '@/src/lib/scheduling-warning';
import {employeeAvailable,syncActualGroomers} from '@/src/lib/groomer-assignment';
import {identifyPackageLines} from '@/src/lib/package-identification';
import {ticketDuration} from '@/src/lib/ticket-timing';
import {resolveSaleLines} from "@/src/lib/pos-lines";
import {appointmentHoursError} from "@/src/lib/location-hours";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const BASE_ROLES = new Set(["PREP", "BATH", "DRY", "GROOM"]);
const ROLES = new Set(["PREP", "BATH", "DRY", "GROOM", "ADD_ON", "PRODUCT"]);

function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

async function getSession(request: NextRequest, tenantId: string) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  return sessionId ? getActiveEmployeeSession(tenantId, sessionId) : null;
}

async function handlePolicyGET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const ticketId = request.nextUrl.searchParams.get("ticketId") || "";
  if (!tenantId || !ticketId) return NextResponse.json({ error: "Tenant and ticket are required." }, { status: 400 });
  const lines = await db.ticketLine.findMany({ where: { ticketId, ticket: { tenantId } }, orderBy: [{ petId: "asc" }, { sortOrder: "asc" }], include: { pet: true, service: true, product: true, assignedUser:{select:{id:true,firstName:true,lastName:true,role:true,active:true}} } });
  return NextResponse.json({ lines });
}

async function handlePolicyPOST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { offerToday?:boolean;present?:boolean;ticketId?: string; petId?: string; type?: "SERVICE" | "PRODUCT" | "PACKAGE"; id?: string; quantity?: number; role?: "PREP" | "BATH" | "DRY" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.type || !body.id) return NextResponse.json({ error: "Ticket, line type, and item are required." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId }, include: { customer: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
  if (body.petId) {
    const pet = await db.pet.findFirst({ where: { id: body.petId, tenantId, customerId: ticket.customerId, active: true } });
    if (!pet) return NextResponse.json({ error: "The selected dog is not on this ticket." }, { status: 400 });
  }
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  if(body.offerToday===true){
    if(body.type!=='SERVICE'||!body.petId||typeof body.present!=='boolean')return NextResponse.json({error:'Choose a dog, service, and Offer Today selection.'},{status:400});
    try{
      const outcome=await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;
        if(body.present){await tx.ticketPet.upsert({where:{ticketId_petId:{ticketId:ticket.id,petId:body.petId!}},create:{ticketId:ticket.id,petId:body.petId!},update:{}});await ensureGroomingNotes(tx,{...ticket,pets:[{petId:body.petId}]},session.user.id);}
        const outcome=await setOfferTodayLine(tx,tenantId,ticket.id,{id:body.id!,petId:body.petId!,present:body.present!,role:body.role},async(live,duration)=>{
          if(live.scheduledStart){const error=await appointmentHoursError(tenantId,live.locationId,live.scheduledStart,duration);if(error&&!await approvedScheduling(request,error))throw schedulingException(error);}
        },{request,userId:session.user.id});
        if(outcome.removedLines.some((line:any)=>line.role==='GROOM'&&line.assignedUserId))await syncActualGroomers(tx,ticket.id);
        const remaining=await tx.ticketLine.findMany({where:{ticketId:ticket.id}}),current=await tx.ticket.findFirst({where:{id:ticket.id,tenantId}});if(!current)throw Error('Ticket not found.');await syncAppointmentPets(tx,current,remaining);
        return outcome;
      });
      if(outcome.changed)await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:outcome.removed?'REMOVE_LINE':'ADD_LINE',summary:`${outcome.removed?'Removed':'Added'} Offer Today: ${outcome.line?.description}.`,details:{lineId:outcome.line?.id,petId:body.petId,offerToday:true}});
      return NextResponse.json(outcome);
    }catch(error){return NextResponse.json({...warningDetails(error),...attendanceDecisionDetails(error),error:(error as Error).message},{status:409});}
  }
  let result;try{const ticketPets=await db.ticketPet.findMany({where:{ticketId:ticket.id}});result=await resolveSaleLines(db,tenantId,[body as any],[...new Set([...ticketPets.map(p=>p.petId),...(body.petId?[body.petId]:[])])],ticket.locationId)}catch(e){return NextResponse.json({...warningDetails(e),error:e instanceof Error?e.message:"Invalid item."},{status:400})}
  const currentLines=await db.ticketLine.findMany({where:{ticketId:ticket.id},include:{service:true}});const durationMin=ticketDuration([...currentLines,...result.lines],ticket.timingMode);
  if(ticket.scheduledStart){const message=await appointmentHoursError(tenantId,ticket.locationId,ticket.scheduledStart,durationMin);if(message&&!await approvedScheduling(request,message))return NextResponse.json(schedulingWarning(message),{status:409})}
  let added;try{added=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;const live=await tx.ticket.findFirst({where:{id:ticket.id,tenantId},include:{lines:{include:{service:true}}}});if(!live||["CLOSED","CANCELLED","NO_SHOW"].includes(live.status))throw Error("This ticket is closed.");const packages=body.type==='PACKAGE'?await tx.package.findMany({where:{tenantId},include:{items:{include:{service:true}}}}):[];const recognized=identifyPackageLines(live.lines,packages);if(body.type==='PACKAGE'){const existing=recognized.filter(l=>l.packageId===body.id&&l.petId===body.petId);if(existing.length)return existing;}const durationMin=ticketDuration([...live.lines,...result!.lines],live.timingMode);if(live.scheduledStart){const error=await appointmentHoursError(tenantId,live.locationId,live.scheduledStart,durationMin);if(error&&!await approvedScheduling(request,error))throw schedulingException(error);for(const userId of new Set(result!.lines.map(l=>l.assignedUserId).filter((id):id is string=>!!id)))if(!await employeeAvailable(tenantId,userId,live.locationId,live.scheduledStart,durationMin))if(!await approvedScheduling(request,'This employee is unavailable for this appointment.'))throw schedulingException('This employee is unavailable for this appointment.')}const added=[];for(const [index,data] of result!.lines.entries())added.push(await tx.ticketLine.create({data:{...data,id:offlineLineId(index),ticketId:ticket.id,sortOrder:currentLines.length+data.sortOrder}}));await syncAppointmentPets(tx,live,[...live.lines,...added]);if(body.petId)await ensureGroomingNotes(tx,{...live,pets:[{petId:body.petId}]},session.user.id);await tx.ticket.update({where:{id:ticket.id},data:await ticketTiming(tx,live,[...live.lines,...added],{request,userId:session.user.id})});if(added.some(l=>l.role==='GROOM'&&l.assignedUserId))await syncActualGroomers(tx,ticket.id);return added});}catch(error){return NextResponse.json({...warningDetails(error),...attendanceDecisionDetails(error),error:(error as Error).message},{status:409})}const line=added[0];const item={name:result.lines.map(l=>l.description).join(", ")};

  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "ADD_LINE", summary: `Added ${item.name} to ticket #${ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role } });
  return NextResponse.json({ line });
}

async function handlePolicyPATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { durationMin?:number;lineId?: string; petId?: string | null; role?: "PREP" | "BATH" | "DRY" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string | null; quantity?: number; unitPriceCents?: number; discountCents?: number; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.lineId) return NextResponse.json({ error: "Ticket line is required." }, { status: 400 });
  const line = await db.ticketLine.findFirst({ where: { id: body.lineId, ticket: { tenantId } }, include: { ticket: true, service: true, pet: true } });
  if (!line) return NextResponse.json({ error: "Ticket line could not be found." }, { status: 404 });
  if(line.description==="Customer Account Balance")return NextResponse.json({error:"Manage this balance through the customer account."},{status:409});
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(line.ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  if (body.role && !ROLES.has(body.role)) return NextResponse.json({ error: "Invalid ticket line role." }, { status: 400 });
  for(const key of ['quantity','unitPriceCents','discountCents','sortOrder','durationMin'] as const){const v=body[key];if(v!==undefined&&(!Number.isInteger(v)||v<(key==='quantity'?1:0)||v>2147483647))return NextResponse.json({error:'Enter valid whole-number quantities and amounts.'},{status:400})}
  const editError=(message:string,status:number)=>Object.assign(new Error(message),{lineEditStatus:status});
  let outcome;try{outcome = await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${line.ticketId} AND tenantId=${tenantId} FOR UPDATE`;
    // Catalog sync and other staff edits may have committed while this request
    // waited. Omitted fields must come from the locked ticket's current line.
    const current=await tx.ticketLine.findFirst({where:{id:line.id,ticketId:line.ticketId,ticket:{tenantId}},include:{ticket:true,service:true,pet:true}});
    if(!current)throw editError('Ticket line could not be found.',404);
    if(current.description==='Customer Account Balance')throw editError('Manage this balance through the customer account.',409);
    if(['CLOSED','CANCELLED','NO_SHOW'].includes(current.ticket.status))throw editError('This ticket is closed.',409);
    if(body.petId!==undefined&&body.petId!==null&&!await tx.ticketPet.findFirst({where:{ticketId:current.ticketId,petId:body.petId}}))throw editError('The selected dog is not on this ticket.',400);
    if(body.role&&BASE_ROLES.has(current.role)&&body.role!==current.role)throw editError('The three package workflow roles stay fixed: Prepping, Bathing, Grooming.',400);
    const assignedUser=body.assignedUserId?await tx.user.findFirst({where:{id:body.assignedUserId,tenantId,active:true}}):null;
    if(body.assignedUserId&&!assignedUser)throw editError('Assigned employee could not be found.',404);
    const quantity=body.quantity??current.quantity,unitPriceCents=body.unitPriceCents??current.unitPriceCents,discountCents=body.discountCents??current.discountCents;
    const totalCents=Math.max(0,unitPriceCents*quantity-discountCents),commissionPct=current.commissionPct==null?null:Number(current.commissionPct);
    const commissionCents=commissionPct==null?0:Math.round(totalCents*commissionPct/100);
    const siblings=await tx.ticketLine.findMany({where:{ticketId:current.ticketId},include:{service:true}});
    const durationMin=ticketDuration(siblings.map(l=>l.id===current.id?{...l,quantity,durationMin:body.durationMin??l.durationMin}:l),current.ticket.timingMode);
    if(current.ticket.scheduledStart){
      const message='This employee is unavailable for this appointment.';
      if(body.assignedUserId&&!await employeeAvailable(tenantId,body.assignedUserId,current.ticket.locationId,current.ticket.scheduledStart,durationMin)&&!await approvedScheduling(request,message))throw schedulingException(message);
      const error=await appointmentHoursError(tenantId,current.ticket.locationId,current.ticket.scheduledStart,durationMin);
      if(error&&!await approvedScheduling(request,error))throw Object.assign(schedulingException(error),{lineEditStatus:409});
    }
    const changed=await tx.ticketLine.update({where:{id:current.id},data:{...(body.assignedUserId!==undefined?{assignmentUnavailable:false}:{}),durationMin:body.durationMin??current.durationMin,petId:body.petId===undefined?current.petId:body.petId,role:body.role||current.role,assignedUserId:body.assignedUserId===undefined?current.assignedUserId:assignedUser?.id||null,assignedAt:body.assignedUserId===undefined?current.assignedAt:assignedUser?new Date():null,quantity,unitPriceCents,discountCents,totalCents,commissionCents,sortOrder:body.sortOrder??current.sortOrder},include:{pet:true,service:true,product:true,assignedUser:{select:{id:true,firstName:true,lastName:true,role:true,active:true}}}});
    await tx.ticket.update({where:{id:current.ticketId},data:await ticketTiming(tx,current.ticket,await tx.ticketLine.findMany({where:{ticketId:current.ticketId},include:{service:true},orderBy:{sortOrder:'asc'}}),{request,userId:session.user.id})});
    if((body.assignedUserId!==undefined||body.role!==undefined)&&(changed.role==='GROOM'||current.role==='GROOM'))await syncActualGroomers(tx,current.ticketId);
    return {changed,previous:current};
  });}catch(error){const status=(error as {lineEditStatus?:number}).lineEditStatus;if(status||warningDetails(error).schedulingWarning||attendanceDecisionDetails(error).attendanceDecision)return NextResponse.json({...warningDetails(error),...attendanceDecisionDetails(error),error:(error as Error).message},{status:status||409});throw error;}
  const {changed,previous}=outcome;
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: previous.ticketId, customerId: previous.ticket.customerId, action: "EDIT_LINE", summary: `Updated ${previous.description} on ticket #${previous.ticket.orderNumber}.`, details: { lineId: previous.id, before: { petId: previous.petId, role: previous.role, assignedUserId: previous.assignedUserId, quantity: previous.quantity, unitPriceCents: previous.unitPriceCents, discountCents: previous.discountCents }, after: { petId: changed.petId, role: changed.role, assignedUserId: changed.assignedUserId, quantity: changed.quantity, unitPriceCents: changed.unitPriceCents, discountCents: changed.discountCents } } });
  return NextResponse.json({ line: changed });
}

async function handlePolicyDELETE(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  const petId=request.nextUrl.searchParams.get('petId'),ticketId=request.nextUrl.searchParams.get('ticketId');
  if(petId){try{const body=await request.json();const result=await db.$transaction(async tx=>{const result=await removePetTicketItems(tx,tenantId,ticketId||'',petId,body.lineIds,{request,userId:session.user.id});const previous=await readPlannedPackages(tenantId,result.ticket.id,tx);if(!result.ticket.checkedInAt&&previous.length)await writePlannedPackages(tx,tenantId,result.ticket.id,[...previous],{...result.ticket,lines:result.remaining},previous);else if(result.removed.some((l:any)=>l.role==='GROOM'&&l.assignedUserId))await syncActualGroomers(tx,result.ticket.id);if(result.removed.length)await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:result.ticket.id,customerId:result.ticket.customerId,action:'REMOVE_PET_ITEMS',summary:'Removed all selected items for one dog.',details:{petId,lineIds:result.removed.map((l:any)=>l.id)}}});return result;});return NextResponse.json({removedLineIds:result.removed.map((l:any)=>l.id),durationMin:result.durationMin,subtotalCents:result.remaining.reduce((n:number,l:any)=>n+l.totalCents,0)});}catch(e){return NextResponse.json({...attendanceDecisionDetails(e),error:(e as Error).message},{status:409})}}
  const lineId = request.nextUrl.searchParams.get("lineId") || "";
  if (!lineId) return NextResponse.json({ error: "Ticket line is required." }, { status: 400 });
  const line = await db.ticketLine.findFirst({ where: { id: lineId, ticket: { tenantId } }, include: { ticket: true } });
  if (!line) return NextResponse.json({ error: "Ticket line could not be found." }, { status: 404 });
  if(line.description==="Customer Account Balance")return NextResponse.json({error:"Manage this balance through the customer account."},{status:409});
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(line.ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  const body=await request.json().catch(()=>({})),policy=ticketWorkspace((await workflowSettings(tenantId)).posLayout).packageRemovalPolicy;
  const choice=policy==='ASK'?(['KEEP_DISCOUNT','REMOVE_DISCOUNT'].includes(body.packageRemovalChoice)?body.packageRemovalChoice:undefined):policy;
  let result;try{result=await db.$transaction(async tx=>{const removed=await removeTicketLine(tx,tenantId,line.ticketId,line.id,choice,async serviceId=>(await getServicePrice(tenantId,line.ticket.locationId,serviceId))?.finalPriceCents??null,{request,userId:session.user.id});if(line.role==='GROOM'&&line.assignedUserId)await syncActualGroomers(tx,line.ticketId);return removed;});}catch(e){return NextResponse.json({...attendanceDecisionDetails(e),error:(e as Error).message,...((e as any).packageRemovalRequired?{packageRemovalRequired:true}:{})},{status:409})}
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: line.ticketId, customerId: line.ticket.customerId, action: "REMOVE_LINE", summary: `Removed ${line.description} from ticket #${line.ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role,packageRemovalChoice:result.choice,repriced:result.priceChanges } });
  return NextResponse.json({ removed: true, lineId });
}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'TICKETS'});
export const POST=withRequestPolicy(handlePolicyPOST, {feature:'TICKETS'});
export const PATCH=withRequestPolicy(handlePolicyPATCH, {feature:'TICKETS'});
export const DELETE=withRequestPolicy(handlePolicyDELETE, {feature:'TICKETS'});
