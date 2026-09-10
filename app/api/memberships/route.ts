import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { writeAudit } from "@/src/lib/audit";

const COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";

async function sessionFor(request: NextRequest, tenantId: string) {
  const sid = request.cookies.get(COOKIE)?.value || "";
  return tenantId && sid ? getActiveEmployeeSession(tenantId, sid) : null;
}

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function nextBillingDate(start: Date, days: number[]) {
  const candidates: Date[] = [];
  for (let offset = 0; offset < 15; offset++) {
    const d = new Date(start); d.setDate(d.getDate() + offset); if (days.includes(d.getDate())) candidates.push(d);
  }
  return candidates[0] || addDays(start, 30);
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request); const customerId = request.nextUrl.searchParams.get("customerId"); const petId = request.nextUrl.searchParams.get("petId");
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const where = customerId ? "customerId" : petId ? "petId" : null; if (!where) return NextResponse.json({ error: "customerId or petId is required." }, { status: 400 });
  const rows = await db.$queryRaw<any[]>`SELECT * FROM Membership WHERE tenantId=${tenantId} AND ${where === "customerId" ? db.$queryRawUnsafe("customerId = ?", customerId) : db.$queryRawUnsafe("petId = ?", petId)}`;
  return NextResponse.json({ memberships: rows });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request); const session = await sessionFor(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required." }, { status: 401 });
  try {
    const b = await request.json(); const customerId = String(b.customerId || ""); const petId = String(b.petId || ""); const name = String(b.name || "Fur EverVIP");
    const recurringPriceCents = Number(b.recurringPriceCents); if (!customerId || !petId || !Number.isInteger(recurringPriceCents) || recurringPriceCents < 0) return NextResponse.json({ error: "Customer, dog, and recurring price are required." }, { status: 400 });
    const customer = await db.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, email: true } });
    const pet = await db.pet.findFirst({ where: { id: petId, customerId, tenantId }, select: { id: true, name: true } });
    if (!customer || !pet) return NextResponse.json({ error: "Customer or dog could not be found." }, { status: 404 });
    const setting = await db.$queryRaw<any[]>`SELECT value FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey='VIP_BILLING_DAYS' LIMIT 1`;
    const billingDays = String(setting[0]?.value || "1,15").split(",").map(Number).filter(n => n >= 1 && n <= 28); const firstBilling = nextBillingDate(new Date(), billingDays.length ? billingDays : [1,15]);
    const id = randomUUID();
    await db.$executeRaw`INSERT INTO Membership (id,tenantId,customerId,petId,name,status,startFeeCents,recurringPriceCents,billingDay,billingDaySecond,billingInArrears,startedAt) VALUES (${id},${tenantId},${customerId},${petId},${name},'ACTIVE',100,${recurringPriceCents},${billingDays[0] || 1},${billingDays[1] || null},true,NOW(3))`;
    await db.$executeRaw`INSERT INTO MembershipPayment (id,tenantId,membershipId,amountCents,taxCents,paymentType,status,scheduledFor) VALUES (${randomUUID()},${tenantId},${id},100,0,'START_VIP','PENDING',NOW(3))`;
    await db.$executeRaw`INSERT INTO MembershipPayment (id,tenantId,membershipId,amountCents,taxCents,paymentType,status,scheduledFor) VALUES (${randomUUID()},${tenantId},${id},${recurringPriceCents},0,'CARD_ON_FILE','PENDING',${firstBilling})`;
    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "MEMBERSHIP", entityId: id, customerId, action: "MEMBERSHIP_STARTED", summary: `Started ${name} for ${pet.name}.`, details: { petId, recurringPriceCents, firstBilling: firstBilling.toISOString(), billingDays } });
    return NextResponse.json({ membershipId: id, benefitsActiveImmediately: true, startFeeCents: 100, firstBillingAt: firstBilling.toISOString() }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to start membership." }, { status: 400 }); }
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request); const session = await sessionFor(request, tenantId);
  if (!session) return NextResponse.json({ error: "Employee PIN is required." }, { status: 401 });
  try {
    const b = await request.json(); const id = String(b.membershipId || ""); const action = String(b.action || "").toUpperCase();
    if (!id || !["CANCEL","PAUSE","RESUME"].includes(action)) return NextResponse.json({ error: "A valid membership and action are required." }, { status: 400 });
    const rows = await db.$queryRaw<any[]>`SELECT * FROM Membership WHERE id=${id} AND tenantId=${tenantId} LIMIT 1`; if (!rows.length) return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    const m = rows[0]; const now = new Date();
    if (action === "RESUME") { await db.$executeRaw`UPDATE Membership SET status='ACTIVE',pausedAt=NULL,pauseRequestedAt=NULL,updatedAt=NOW(3) WHERE id=${id} AND tenantId=${tenantId}`; }
    else {
      const notice = await db.$queryRaw<any[]>`SELECT value FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey='VIP_CANCELLATION_NOTICE_DAYS' LIMIT 1`;
      const days = Math.max(0, Number(notice[0]?.value || 30)); const finalBilling = addDays(now, days);
      const status = action === "CANCEL" ? "CANCELLATION_REQUESTED" : "PAUSE_REQUESTED";
      await db.$executeRaw`UPDATE Membership SET status=${status},${action === "CANCEL" ? db.$queryRawUnsafe("cancelRequestedAt = ?", now) : db.$queryRawUnsafe("pauseRequestedAt = ?", now)},finalBillingAt=${finalBilling},updatedAt=NOW(3) WHERE id=${id} AND tenantId=${tenantId}`;
      await db.$executeRaw`INSERT INTO MembershipRequest (id,tenantId,membershipId,requestType,source,receivedAt,receivedByUserId,effectiveAt,finalBillingAt) VALUES (${randomUUID()},${tenantId},${id},${action},'EMPLOYEE_ATTESTATION',${now},${session.user.id},${finalBilling},${finalBilling})`;
    }
    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "MEMBERSHIP", entityId: id, action: `MEMBERSHIP_${action}`, summary: `Membership ${action.toLowerCase()} request recorded.`, details: { requestReceivedAt: now.toISOString() } });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to update membership." }, { status: 400 }); }
}
