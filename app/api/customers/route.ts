import {customerMessagePreferences} from '@/src/lib/customer-message-preferences';
import {newCustomerPhones} from '@/src/lib/new-customer-phones';
import {offlineCreateId} from '@/src/lib/offline-transaction';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {customerDetails} from "@/src/lib/customer-details";
import {saveCustomerPhones} from '@/src/lib/customer-phones';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { findPossibleDuplicateCustomer, normalizeText } from "@/src/lib/customer";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { customerReferrals, saveCustomerReferral } from '@/src/lib/customer-referrals';

const SESSION_COOKIE = "groompro_session";

async function handlePolicyPOST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating a customer." }, { status: 401 });

  let body: { phones?:any[];firstName?: string; lastName?: string; email?: string; phone?: string; notes?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const firstName = normalizeText(String(body.firstName || ""));
  const lastName = normalizeText(String(body.lastName || ""));
  const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
  let phones:any[];try{phones=newCustomerPhones(body);}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}

  if (!firstName || !lastName || firstName.length > 191 || lastName.length > 191) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  if (email && (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });


  const duplicate = await findPossibleDuplicateCustomer(tenantId, { firstName, lastName, email, phones:phones.map(p=>String(p.number)) });
  if (duplicate) {
    return NextResponse.json({ duplicate: true, customer: duplicate, message: "This phone number already belongs to a customer. Open their existing profile." }, { status: 409 });
  }

  try {
  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({ data: { ...customerDetails(body),...customerMessagePreferences(body),id:offlineCreateId(),tenantId, firstName, lastName, email, notes: body.notes?.trim() || null } });
    await saveCustomerPhones(tx,tenantId,created.id,phones);
    await saveCustomerReferral(tx, tenantId, created.id, body);
    const record=await tx.customer.findUniqueOrThrow({ where: { id: created.id }, include: { phones: true, pets: true } });
    return {...record,...(await customerReferrals(tenantId,[created.id],tx)).get(created.id)};
  });

  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "CUSTOMER", entityId: customer!.id, customerId: customer!.id, action: "CREATE", summary: `Created customer ${firstName} ${lastName}.` });
  return NextResponse.json({ customer }, { status: 201 });
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save customer."},{status:400});}
}

export const POST=withRequestPolicy(handlePolicyPOST, {feature:'CUSTOMERS'});
