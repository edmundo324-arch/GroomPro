import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { findPossibleDuplicateCustomer, normalizePhone, normalizeText } from "@/src/lib/customer";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating a customer." }, { status: 401 });

  let body: { firstName?: string; lastName?: string; email?: string; phone?: string; notes?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const firstName = normalizeText(String(body.firstName || ""));
  const lastName = normalizeText(String(body.lastName || ""));
  const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
  const phone = body.phone ? String(body.phone).trim() : undefined;
  const normalizedPhone = phone ? normalizePhone(phone) : "";

  if (!firstName || !lastName) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  if (phone && normalizedPhone.length < 7) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const duplicate = await findPossibleDuplicateCustomer(tenantId, { firstName, lastName, email, phone });
  if (duplicate) {
    return NextResponse.json({ duplicate: true, customer: duplicate, message: "An existing customer matches this information." }, { status: 409 });
  }

  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({ data: { tenantId, firstName, lastName, email, notes: body.notes?.trim() || null } });
    if (phone) await tx.customerPhone.create({ data: { tenantId, customerId: created.id, number: phone, normalized: normalizedPhone, isPrimary: true } });
    return tx.customer.findUnique({ where: { id: created.id }, include: { phones: true, pets: true } });
  });

  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "CUSTOMER", entityId: customer!.id, customerId: customer!.id, action: "CREATE", summary: `Created customer ${firstName} ${lastName}.` });
  return NextResponse.json({ customer }, { status: 201 });
}
