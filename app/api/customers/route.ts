import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { findPossibleDuplicateCustomer, normalizePhone, normalizeText } from "@/src/lib/customer";

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const body = await request.json();
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
    const created = await tx.customer.create({ data: { tenantId, firstName, lastName, email } });
    if (phone) {
      await tx.customerPhone.create({
        data: { tenantId, customerId: created.id, number: phone, normalized: normalizedPhone, isPrimary: true },
      });
    }
    return tx.customer.findUnique({ where: { id: created.id }, include: { phones: true, pets: true } });
  });

  return NextResponse.json({ customer }, { status: 201 });
}
