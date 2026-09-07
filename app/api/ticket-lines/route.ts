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
  const lines = await db.ticketLine.findMany({ where: { ticketId, ticket: { tenantId } }, orderBy: [{ petId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }], include: { pet: true, service: true, product: true, assignedUser: true } });
  return NextResponse.json({ lines });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { ticketId?: string; petId?: string; type?: "SERVICE" | "PRODUCT"; id?: string; quantity?: number; role?: "PREP" | "BATH" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.type || !body.id) return NextResponse.json({ error: "Ticket, line type, and item are required." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId }, include: { customer: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
  if (body.petId) {
    const pet = await db.ticketPet.findFirst({ where: { ticketId: ticket.id, petId: body.petId } });
    if (!pet) return NextResponse.json({ error: "The selected dog is not on this ticket." }, { status: 400 });
  }
  const role = body.role || (body.type === "PRODUCT" ? "PRODUCT" : "ADD_ON");
  if (!ROLES.has(role)) return NextResponse.json({ error: "Invalid ticket line role." }, { status: 400 });
  if (role !== "PRODUCT" && body.type === "PRODUCT") return NextResponse.json({ error: "Merchandise lines use the Product role." }, { status: 400 });
  const assignedUser = body.assignedUserId ? await db.user.findFirst({ where: { id: body.assignedUserId, tenantId, active: true } }) : null;
  if (body.assignedUserId && !assignedUser) return NextResponse.json({ error: "Assigned employee could not be found." }, { status: 404 });
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const item = body.type === "SERVICE"
    ? await db.service.findFirst({ where: { id: body.id, tenantId, active: true } })
    : await db.product.findFirst({ where: { id: body.id, tenantId, active: true } });
  if (!item) return NextResponse.json({ error: "Service or product could not be found." }, { status: 404 });
  const unitPriceCents = item.priceCents;
  const totalCents = unitPriceCents * quantity;
  const commissionPct = body.type === "SERVICE" && "commissionPct" in item && item.commissionPct != null ? Number(item.commissionPct) : null;
  const commissionCents = commissionPct == null ? 0 : Math.round(totalCents * commissionPct / 100);
  const line = await db.ticketLine.create({ data: { ticketId: ticket.id, lineType: body.type, role: role as any, serviceId: body.type === "SERVICE" ? body.id : null, productId: body.type === "PRODUCT" ? body.id : null, petId: body.petId || null, description: item.name, quantity, unitPriceCents, totalCents, commissionPct, commissionCents, sortOrder: Number(body.sortOrder) || 0, assignedUserId: assignedUser?.id || null, assignedAt: assignedUser ? new Date() : null }, include: { pet: true, service: true, product: true, assignedUser: true } });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "ADD_LINE", summary: `Added ${item.name} to ticket #${ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role } });
  return NextResponse.json({ line });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const session = await getSession(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket lines." }, { status: 401 });
  let body: { lineId?: string; petId?: string | null; role?: "PREP" | "BATH" | "GROOM" | "ADD_ON" | "PRODUCT"; assignedUserId?: string | null; quantity?: number; unitPriceCents?: number; discountCents?: number; sortOrder?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.lineId) return NextResponse.json({ error: "Ticket line is required." }, { status: 400 });
  const line = await db.ticketLine.findFirst({ where: { id: body.lineId, ticket: { tenantId } }, include: { ticket: true, service: true, pet: true } });
  if (!line) return NextResponse.json({ error: "Ticket line could not be found." }, { status: 404 });
  if (body.petId !== undefined && body.petId !== null) {
    const ticketPet = await db.ticketPet.findFirst({ where: { ticketId: line.ticketId, petId: body.petId } });
    if (!ticketPet) return NextResponse.json({ error: "The selected dog is not on this ticket." }, { status: 400 });
  }
  if (body.role && !ROLES.has(body.role)) return NextResponse.json({ error: "Invalid ticket line role." }, { status: 400 });
  if (body.role && BASE_ROLES.has(line.role) && body.role !== line.role) return NextResponse.json({ error: "The three package workflow roles stay fixed: Prepping, Bathing, Grooming." }, { status: 400 });
  const assignedUser = body.assignedUserId ? await db.user.findFirst({ where: { id: body.assignedUserId, tenantId, active: true } }) : null;
  if (body.assignedUserId && !assignedUser) return NextResponse.json({ error: "Assigned employee could not be found." }, { status: 404 });
  const quantity = body.quantity === undefined ? line.quantity : Math.max(1, Number(body.quantity) || 1);
  const unitPriceCents = body.unitPriceCents === undefined ? line.unitPriceCents : Math.max(0, Number(body.unitPriceCents) || 0);
  const discountCents = body.discountCents === undefined ? line.discountCents : Math.max(0, Number(body.discountCents) || 0);
  const totalCents = Math.max(0, unitPriceCents * quantity - discountCents);
  const commissionPct = line.commissionPct == null ? null : Number(line.commissionPct);
  const commissionCents = commissionPct == null ? 0 : Math.round(totalCents * commissionPct / 100);
  const changed = await db.ticketLine.update({ where: { id: line.id }, data: { petId: body.petId === undefined ? line.petId : body.petId, role: body.role || line.role, assignedUserId: body.assignedUserId === undefined ? line.assignedUserId : assignedUser?.id || null, assignedAt: body.assignedUserId === undefined ? line.assignedAt : assignedUser ? new Date() : null, quantity, unitPriceCents, discountCents, totalCents, commissionCents, sortOrder: body.sortOrder === undefined ? line.sortOrder : Number(body.sortOrder) }, include: { pet: true, service: true, product: true, assignedUser: true } });
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
  if (BASE_ROLES.has(line.role)) return NextResponse.json({ error: "The three package workflow services cannot be removed from the ticket." }, { status: 409 });
  await db.ticketLine.delete({ where: { id: line.id } });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: line.ticketId, customerId: line.ticket.customerId, action: "REMOVE_LINE", summary: `Removed ${line.description} from ticket #${line.ticket.orderNumber}.`, details: { lineId: line.id, petId: line.petId, role: line.role } });
  return NextResponse.json({ removed: true, lineId });
}
