import {identifyPackageLines} from '@/src/lib/package-identification';
import {ticketDuration} from '@/src/lib/ticket-timing';
import {resolveSaleLines} from "@/src/lib/pos-lines";
import {appointmentHoursError} from "@/src/lib/location-hours";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const BASE_ROLES = new Set(["PREP", "BATH", "GROOM"]);
const ROLES = new Set(["PREP", "BATH", "GROOM", "ADD_ON", "PRODUCT"]);

function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

async function getSession(request: NextRequest, tenantId: string) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  return sessionId ? getActiveEmployeeSession(tenantId, sessionId) : null;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const ticketId = request.nextUrl.searchParams.get("ticketId") || "";
  if (!tenantId || !ticketId) return NextResponse.json({ error: "Tenant and ticket are required." }, { status: 400 });
  const lines = await db.ticketLine.findMany({ where: { ticketId, ticket: { tenantId } }, orderBy: [{ petId: "asc" }, { sortOrder: "asc" }], include: { pet: true, service: true, product: true, assignedUser:{select:{id:true,firstName:true,lastName:true,role:true,active:true}} } });
  return NextResponse.json({ lines });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { ticketId?: string; petId?: string; type?: "SERVICE" | "PRODUCT" | "PACKAGE"; id?: string; quantity?: number; role?: "PREP" | "BATH" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.type || !body.id) return NextResponse.json({ error: "Ticket, line type, and item are required." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId }, include: { customer: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
  if (body.petId) {
    const pet = await db.ticketPet.findFirst({ where: { ticketId: ticket.id, petId: body.petId } });
    if (!pet) return NextResponse.json({ error: "The selected dog is not on this ticket." }, { status: 400 });
  }
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  let result;try{const ticketPets=await db.ticketPet.findMany({where:{ticketId:ticket.id}});result=await resolveSaleLines(db,tenantId,[body as any],ticketPets.map(p=>p.petId),ticket.locationId)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid item."},{status:400})}
  const currentLines=await db.ticketLine.findMany({where:{ticketId:ticket.id},include:{service:true}});const durationMin=ticketDuration([...currentLines,...result.lines],ticket.timingMode);
  if(ticket.scheduledStart){const message=await appointmentHoursError(tenantId,ticket.locationId,ticket.scheduledStart,durationMin);if(message)return NextResponse.json({error:message},{status:400})}
  let added;try{added=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;const live=await tx.ticket.findFirst({where:{id:ticket.id,tenantId},include:{lines:{include:{service:true}}}});if(!live||["CLOSED","CANCELLED","NO_SHOW"].includes(live.status))throw Error("This ticket is closed.");const packages=body.type==='PACKAGE'?await tx.package.findMany({where:{tenantId},include:{items:{include:{service:true}}}}):[];const recognized=identifyPackageLines(live.lines,packages);if(body.type==='PACKAGE'){const existing=recognized.filter(l=>l.packageId===body.id&&l.petId===body.petId);if(existing.length)return existing;}const durationMin=ticketDuration([...live.lines,...result!.lines],live.timingMode);if(live.scheduledStart){const error=await appointmentHoursError(tenantId,live.locationId,live.scheduledStart,durationMin);if(error)throw Error(error)}const added=[];for(const data of result!.lines)added.push(await tx.ticketLine.create({data:{...data,ticketId:ticket.id,sortOrder:currentLines.length+data.sortOrder}}));await tx.ticket.update({where:{id:ticket.id},data:{durationMin}});return added});}catch(error){return NextResponse.json({error:(error as Error).message},{status:409})}const line=added[0];const item={name:result.lines.map(l=>l.description).join(", ")};

  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "ADD_LINE", summary: `Added ${item.name} to ticket #${ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role } });
  return NextResponse.json({ line });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { durationMin?:number;lineId?: string; petId?: string | null; role?: "PREP" | "BATH" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string | null; quantity?: number; unitPriceCents?: number; discountCents?: number; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.lineId) return NextResponse.json({ error: "Ticket line is required." }, { status: 400 });
  const line = await db.ticketLine.findFirst({ where: { id: body.lineId, ticket: { tenantId } }, include: { ticket: true, service: true, pet: true } });
  if (!line) return NextResponse.json({ error: "Ticket line could not be found." }, { status: 404 });
  if(line.description==="Customer Account Balance")return NextResponse.json({error:"Manage this balance through the customer account."},{status:409});
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(line.ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  if (body.petId !== undefined && body.petId !== null) {
    const ticketPet = await db.ticketPet.findFirst({ where: { ticketId: line.ticketId, petId: body.petId } });
    if (!ticketPet) return NextResponse.json({ error: "The selected dog is not on this ticket." }, { status: 400 });
  }
  if (body.role && !ROLES.has(body.role)) return NextResponse.json({ error: "Invalid ticket line role." }, { status: 400 });
  if (body.role && BASE_ROLES.has(line.role) && body.role !== line.role) return NextResponse.json({ error: "The three package workflow roles stay fixed: Prepping, Bathing, Grooming." }, { status: 400 });
  const assignedUser = body.assignedUserId ? await db.user.findFirst({ where: { id: body.assignedUserId, tenantId, active: true } }) : null;
  if (body.assignedUserId && !assignedUser) return NextResponse.json({ error: "Assigned employee could not be found." }, { status: 404 });
  for(const key of ['quantity','unitPriceCents','discountCents','sortOrder','durationMin'] as const){const v=body[key];if(v!==undefined&&(!Number.isInteger(v)||v<(key==='quantity'?1:0)||v>2147483647))return NextResponse.json({error:'Enter valid whole-number quantities and amounts.'},{status:400})}
  const quantity = body.quantity === undefined ? line.quantity : Math.max(1, Number(body.quantity) || 1);
  const unitPriceCents = body.unitPriceCents === undefined ? line.unitPriceCents : Math.max(0, Number(body.unitPriceCents) || 0);
  const discountCents = body.discountCents === undefined ? line.discountCents : Math.max(0, Number(body.discountCents) || 0);
  const totalCents = Math.max(0, unitPriceCents * quantity - discountCents);
  const commissionPct = line.commissionPct == null ? null : Number(line.commissionPct);
  const commissionCents = commissionPct == null ? 0 : Math.round(totalCents * commissionPct / 100);
  const siblings=await db.ticketLine.findMany({where:{ticketId:line.ticketId},include:{service:true}});const durationMin=ticketDuration(siblings.map(l=>l.id===line.id?{...l,quantity,durationMin:body.durationMin??l.durationMin}:l),line.ticket.timingMode);
  if(line.ticket.scheduledStart){const error=await appointmentHoursError(tenantId,line.ticket.locationId,line.ticket.scheduledStart,durationMin);if(error)return NextResponse.json({error},{status:400})}
  const changed = await db.$transaction(async tx=>{const changed=await tx.ticketLine.update({ where: { id: line.id }, data: {durationMin:body.durationMin??line.durationMin, petId: body.petId === undefined ? line.petId : body.petId, role: body.role || line.role, assignedUserId: body.assignedUserId === undefined ? line.assignedUserId : assignedUser?.id || null, assignedAt: body.assignedUserId === undefined ? line.assignedAt : assignedUser ? new Date() : null, quantity, unitPriceCents, discountCents, totalCents, commissionCents, sortOrder: body.sortOrder === undefined ? line.sortOrder : Number(body.sortOrder) }, include: { pet: true, service: true, product: true, assignedUser:{select:{id:true,firstName:true,lastName:true,role:true,active:true}} } });
  await tx.ticket.update({where:{id:line.ticketId},data:{durationMin}});return changed});
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: line.ticketId, customerId: line.ticket.customerId, action: "EDIT_LINE", summary: `Updated ${line.description} on ticket #${line.ticket.orderNumber}.`, details: { lineId: line.id, before: { petId: line.petId, role: line.role, assignedUserId: line.assignedUserId, quantity: line.quantity, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents }, after: { petId: changed.petId, role: changed.role, assignedUserId: changed.assignedUserId, quantity: changed.quantity, unitPriceCents: changed.unitPriceCents, discountCents: changed.discountCents } } });
  return NextResponse.json({ line: changed });
}

export async function DELETE(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  const lineId = request.nextUrl.searchParams.get("lineId") || "";
  if (!lineId) return NextResponse.json({ error: "Ticket line is required." }, { status: 400 });
  const line = await db.ticketLine.findFirst({ where: { id: lineId, ticket: { tenantId } }, include: { ticket: true } });
  if (!line) return NextResponse.json({ error: "Ticket line could not be found." }, { status: 404 });
  if(line.description==="Customer Account Balance")return NextResponse.json({error:"Manage this balance through the customer account."},{status:409});
  if(["CLOSED","CANCELLED","NO_SHOW"].includes(line.ticket.status))return NextResponse.json({error:"This ticket is closed."},{status:409});
  await db.$transaction(async tx=>{await tx.ticketLine.delete({ where: { id: line.id } });const remaining=await tx.ticketLine.findMany({where:{ticketId:line.ticketId},include:{service:true}});const durationMin=ticketDuration(remaining,line.ticket.timingMode);await tx.ticket.update({where:{id:line.ticketId},data:{durationMin}})});
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: line.ticketId, customerId: line.ticket.customerId, action: "REMOVE_LINE", summary: `Removed ${line.description} from ticket #${line.ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role } });
  return NextResponse.json({ removed: true, lineId });
}
