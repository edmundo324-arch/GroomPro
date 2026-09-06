import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating an appointment." }, { status: 401 });

  let body: { customerId?: string; petId?: string; serviceId?: string; scheduledStart?: string; durationMin?: number; notes?: string; groomerId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (!body.customerId || !body.petId || !body.serviceId || !body.scheduledStart) return NextResponse.json({ error: "Customer, pet, service, and appointment time are required." }, { status: 400 });
  const scheduledStart = new Date(body.scheduledStart);
  if (Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });

  const [customer, pet, service] = await Promise.all([
    db.customer.findFirst({ where: { id: body.customerId, tenantId, active: true } }),
    db.pet.findFirst({ where: { id: body.petId, tenantId, customerId: body.customerId, active: true } }),
    db.service.findFirst({ where: { id: body.serviceId, tenantId, active: true } }),
  ]);
  if (!customer || !pet || !service) return NextResponse.json({ error: "Customer, pet, or service could not be found." }, { status: 404 });

  const durationMin = Math.max(15, Number(body.durationMin) || service.durationMin || 30);
  const orderAggregate = await db.ticket.aggregate({ where: { tenantId }, _max: { orderNumber: true } });
  const orderNumber = (orderAggregate._max.orderNumber || 0) + 1;

  const ticket = await db.ticket.create({
    data: {
      tenantId,
      locationId,
      customerId: customer.id,
      orderNumber,
      scheduledStart,
      durationMin,
      status: "OPEN",
      notes: body.notes?.trim() || null,
      pets: { create: { petId: pet.id } },
      lines: { create: { lineType: "SERVICE", serviceId: service.id, petId: pet.id, description: service.name, quantity: 1, unitPriceCents: service.priceCents, totalCents: service.priceCents } },
      ...(body.groomerId ? { assignments: { create: { userId: body.groomerId, role: "GROOMER" } } } : {}),
    },
    include: { customer: true, pets: { include: { pet: true } }, lines: true, assignments: { include: { user: true } } },
  });

  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: customer.id, action: "CREATE", summary: `Created appointment #${orderNumber} for ${pet.name}.` });
  return NextResponse.json({ ticket }, { status: 201 });
}
