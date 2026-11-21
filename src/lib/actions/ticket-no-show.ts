import {settleNoShowFromAccount} from '@/src/lib/no-show-account';
import {reserveNoShowCardCredit,releaseNoShowCardCredit} from '@/src/lib/no-show-card-credit';
import {noShowOperationKey} from '@/src/lib/no-show-operation';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { getTenantNumberSetting } from "@/src/lib/customer-account";
import { chargeCloverToken } from "@/src/lib/clover-payments";
import { writeAudit } from "@/src/lib/audit";
import { randomUUID } from "node:crypto";

const COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const sid = request.cookies.get(COOKIE)?.value || "";
  const session = tenantId && sid ? await getActiveEmployeeSession(tenantId, sid) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required to process a No-Show." }, { status: 401 });

  try {
    const body = await request.json();
    const ticketId = String(body.ticketId || "");
    const ticketRows = await db.$queryRaw<any[]>`SELECT t.id,t.customerId,t.locationId,t.orderNumber,t.status,t.noShowFeeProcessedAt,c.firstName,c.lastName,c.email FROM Ticket t JOIN Customer c ON c.id=t.customerId AND c.tenantId=t.tenantId WHERE t.id=${ticketId} AND t.tenantId=${tenantId} LIMIT 1`;
    if (!ticketRows.length) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
    const ticket = ticketRows[0];
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") return NextResponse.json({ error: "This ticket can no longer be marked as a No-Show." }, { status: 409 });
    if (ticket.noShowFeeProcessedAt) return NextResponse.json({ success: true, message: "The No-Show fee has already been processed." });

    const feeCents = Math.max(0, Math.round(await getTenantNumberSetting(tenantId, "NO_SHOW_FEE_CENTS", 4500)));
    const methods = await db.$queryRaw<any[]>`SELECT id,provider,providerPaymentMethodId,brand,last4 FROM CustomerPaymentMethod WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND active=true ORDER BY isDefault DESC,createdAt DESC LIMIT 1`;

    const accountSettlement=await settleNoShowFromAccount(db,tenantId,session.user.id,ticketId,feeCents,methods.length>0);
    if(accountSettlement)return NextResponse.json(accountSettlement);

    if (methods.length) {
      const method = methods[0];
      if (method.provider !== "CLOVER") return NextResponse.json({ error: "A card is on file, but its payment provider is not connected yet. Connect the payment provider before charging the No-Show fee." }, { status: 409 });
      const reservation=await reserveNoShowCardCredit(db,tenantId,ticketId,session.user.id,feeCents);if(!reservation)return NextResponse.json({success:true,message:'The No-Show fee has already been processed.'});
      const charge = reservation.chargeCents?await chargeCloverToken({ idempotencyKey:reservation.operationId, source: method.providerPaymentMethodId, amountCents: reservation.chargeCents, description: `No-Show Fee for Ticket #${ticket.orderNumber}`, externalReference: String(ticket.orderNumber), receiptEmail: ticket.email }):{ok:true,chargeId:undefined};
      if (!charge.ok) {await releaseNoShowCardCredit(db,tenantId,ticketId,session.user.id,reservation.operationId);return NextResponse.json({ error: charge.message || "The card-on-file charge was not successful. The No-Show Fee has not been posted to the customer balance." }, { status: 402 });}
      const paymentId = randomUUID();
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
        const operation=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:noShowOperationKey(ticketId)}}}))?.value as any;if(operation?.state!=='RUNNING'||operation.operationId!==reservation.operationId)throw Error('This charge needs verification before recording another fee.');
        const lineId = randomUUID();
        await tx.$executeRaw`INSERT INTO TicketLine (id,ticketId,lineType,role,description,quantity,unitPriceCents,discountCents,totalCents,sortOrder) VALUES (${lineId},${ticketId},'SERVICE','ADD_ON','No-Show Fee',1,${feeCents},0,${feeCents},9999)`;
        if(reservation.chargeCents)await tx.$executeRaw`INSERT INTO Payment (id,tenantId,ticketId,amount,paymentType,externalId) VALUES (${paymentId},${tenantId},${ticketId},${(reservation.chargeCents/100).toFixed(2)},${String(method.brand || "OTHER").toUpperCase().replace(/[^A-Z_]/g, "") || "OTHER"},${charge.chargeId || null})`;
        await tx.$executeRaw`UPDATE Ticket SET accountCreditCents=accountCreditCents+${reservation.creditUsedCents},noShowFeeCents=${feeCents},noShowFeeProcessedAt=CURRENT_TIMESTAMP(3),noShowFeePaymentId=${reservation.chargeCents?paymentId:null},status='CANCELLED',closedAt=CURRENT_TIMESTAMP(3) WHERE id=${ticketId} AND tenantId=${tenantId}`;
        await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:noShowOperationKey(ticketId)}},data:{value:{...reservation,state:'DONE',completedAt:new Date().toISOString(),chargeId:charge.chargeId||null}}});
      });
      await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticketId, customerId: ticket.customerId, action: "NO_SHOW_FEE_CHARGED", summary: `Applied $${(reservation.creditUsedCents/100).toFixed(2)} Customer Credit and charged $${(reservation.chargeCents/100).toFixed(2)} to card on file for ticket #${ticket.orderNumber}.`, details: { feeCents, creditUsedCents:reservation.creditUsedCents, chargeCents:reservation.chargeCents, paymentId, chargeId: charge.chargeId, last4: method.last4, noShowStatus: "NO_SHOW" } });
      return NextResponse.json({ success: true, method: reservation.chargeCents?"CARD_ON_FILE":"CUSTOMER_CREDIT", feeCents, creditUsedCents:reservation.creditUsedCents, chargedCents:reservation.chargeCents, closed: true });
    }

    return NextResponse.json({error:'Review the customer account before trying this fee again.'},{status:409});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process No-Show fee." }, { status: 400 });
  }
}

