import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { addAccountEntry, getTenantNumberSetting } from "@/src/lib/customer-account";
import { chargeCloverToken } from "@/src/lib/clover-payments";
import { writeAudit } from "@/src/lib/audit";
import { randomUUID } from "node:crypto";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";

export async function POST(request:NextRequest){
 const tenantId=tenantFrom(request);const sid=request.cookies.get(COOKIE)?.value||"";const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required to process a No-Show."},{status:401});
 try{
  const body=await request.json();const ticketId=String(body.ticketId||"");
  const ticketRows=await db.$queryRaw<any[]>`SELECT t.id,t.customerId,t.locationId,t.orderNumber,t.status,t.noShowFeeProcessedAt,c.firstName,c.lastName,c.email FROM Ticket t JOIN Customer c ON c.id=t.customerId AND c.tenantId=t.tenantId WHERE t.id=${ticketId} AND t.tenantId=${tenantId} LIMIT 1`;
  if(!ticketRows.length)return NextResponse.json({error:"Ticket could not be found."},{status:404});
  const ticket=ticketRows[0];
  if(ticket.status==="CLOSED"||ticket.status==="CANCELLED")return NextResponse.json({error:"This ticket can no longer be marked as a No-Show."},{status:409});
  if(ticket.noShowFeeProcessedAt)return NextResponse.json({success:true,message:"The No-Show fee has already been processed."});
  const feeCents=await getTenantNumberSetting(tenantId,"NO_SHOW_FEE_CENTS",4500);
  const methods=await db.$queryRaw<any[]>`SELECT id,provider,providerPaymentMethodId,brand,last4 FROM CustomerPaymentMethod WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND active=true ORDER BY isDefault DESC,createdAt DESC LIMIT 1`;

  if(methods.length){
   const method=methods[0];
   if(method.provider!=="CLOVER")return NextResponse.json({error:"A card is on file, but its payment provider is not connected yet. Connect the payment provider before charging the No-Show fee."},{status:409});
   const charge=await chargeCloverToken({source:method.providerPaymentMethodId,amountCents:feeCents,description:`No-Show Fee for Ticket #${ticket.orderNumber}`,externalReference:String(ticket.orderNumber),receiptEmail:ticket.email});
   if(!charge.ok)return NextResponse.json({error:charge.message||"The card-on-file charge was not successful. The $45 fee has not been posted to the customer balance."},{status:402});
   const paymentId=randomUUID();
   await db.$transaction(async tx=>{
    const lineId=randomUUID();
    await tx.$executeRaw`INSERT INTO TicketLine (id,ticketId,lineType,role,description,quantity,unitPriceCents,discountCents,totalCents,sortOrder) VALUES (${lineId},${ticketId},'SERVICE','ADD_ON','No-Show Fee',1,${feeCents},0,${feeCents},9999)`;
    await tx.$executeRaw`INSERT INTO Payment (id,tenantId,ticketId,amount,paymentType,externalId) VALUES (${paymentId},${tenantId},${ticketId},${(feeCents/100).toFixed(2)},${String(method.brand||"OTHER").toUpperCase().replace(/[^A-Z_]/g,"")||"OTHER"},${charge.chargeId||null})`;
    await tx.$executeRaw`UPDATE Ticket SET noShowFeeCents=${feeCents},noShowFeeProcessedAt=CURRENT_TIMESTAMP(3),noShowFeePaymentId=${paymentId},status='NO_SHOW',closedAt=CURRENT_TIMESTAMP(3) WHERE id=${ticketId} AND tenantId=${tenantId}`;
   });
   await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticketId,customerId:ticket.customerId,action:"NO_SHOW_FEE_CHARGED",summary:`Charged $${(feeCents/100).toFixed(2)} No-Show Fee to card on file for ticket #${ticket.orderNumber}.`,details:{feeCents,paymentId,chargeId:charge.chargeId,last4:method.last4}});
   return NextResponse.json({success:true,method:"CARD_ON_FILE",feeCents,closed:true});
  }

  const ledgerId=await addAccountEntry({tenantId,customerId:ticket.customerId,ticketId,actorUserId:session.user.id,entryType:"OWED",amountCents:feeCents,reason:`No-Show Fee for Ticket #${ticket.orderNumber}`});
  await db.$executeRaw`UPDATE Ticket SET noShowFeeCents=${feeCents},noShowFeeProcessedAt=CURRENT_TIMESTAMP(3),status='NO_SHOW',closedAt=CURRENT_TIMESTAMP(3) WHERE id=${ticketId} AND tenantId=${tenantId}`;
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticketId,customerId:ticket.customerId,action:"NO_SHOW_FEE_TO_ACCOUNT",summary:`Added $${(feeCents/100).toFixed(2)} No-Show Fee to customer account balance for ticket #${ticket.orderNumber}.`,details:{feeCents,ledgerId}});
  return NextResponse.json({success:true,method:"ACCOUNT_BALANCE",feeCents,closed:true,message:`Customer now owes $${(feeCents/100).toFixed(2)}. The balance will be brought onto the next grooming ticket.`});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to process No-Show fee."},{status:400});}
}
