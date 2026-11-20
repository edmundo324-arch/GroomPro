import {refreshRebookingDiscounts} from '@/src/lib/rebooking-discount-store';
import {mainRebookingLineIds} from '@/src/lib/rebooking-discount-rules';
import {isPrepaidPurchaseLine} from '@/src/lib/prepaid-lines';
import {queueInitialAttendanceRequest} from '@/src/lib/appointment-message-acceptance';
import {offlineCreateId,offlineLineId} from '@/src/lib/offline-transaction';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {ticketDuration} from '@/src/lib/ticket-timing';
import {attendingPets} from '@/src/lib/appointment-pets';
import {approvedScheduling} from '@/src/lib/scheduling-authorization';
import {ensureGroomingNotes} from '@/src/lib/grooming-notes-store';
import {schedulingApproved,schedulingWarning,schedulingException,warningDetails} from '@/src/lib/scheduling-warning';
import {bookingAssetError} from '@/src/lib/booking-asset';
import {employeeAvailable} from '@/src/lib/groomer-assignment';
import {nextTicketNumber} from '@/src/lib/ticket-number';
import { appointmentHoursError } from "@/src/lib/location-hours";
import { requestLocation } from "@/src/lib/request-location";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { checkCustomerBookingRules } from "@/src/lib/booking-rules";

const COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = await requestLocation(request, tenantId);
  const sid = request.cookies.get(COOKIE)?.value || "";
  const session = tenantId && sid ? await getActiveEmployeeSession(tenantId, sid) : null;
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  if (!session) return NextResponse.json({ error: "Employee PIN is required before rebooking." }, { status: 401 });

  try {
    const body = await request.json();
    const ticketId = String(body.ticketId || "");
    const scheduledStart = new Date(String(body.scheduledStart || ""));
    const groomerId = body.groomerId ? String(body.groomerId) : null;
    if (!ticketId || Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Original ticket and a valid new appointment time are required." }, { status: 400 });

    let source = await db.ticket.findFirst({ where: { id: ticketId, tenantId, locationId }, include: { pets: true, lines: { include: {service:true}, orderBy: { sortOrder: "asc" } } } });
    if (!source) return NextResponse.json({ error: "Original ticket could not be found." }, { status: 404 });
    source=attendingPets(source);
    if (source.status === "CANCELLED") return NextResponse.json({ error: "A cancelled appointment cannot be rebooked." }, { status: 409 });

    const businessMode=(await workflowSettings(tenantId)).timingMode;const durationMin=ticketDuration(source.lines,businessMode);
    const hoursMessage=await appointmentHoursError(tenantId,locationId,scheduledStart,durationMin);if(hoursMessage&&!await approvedScheduling(request,hoursMessage))return NextResponse.json(schedulingWarning(hoursMessage),{status:409});
    const assetMessage=await bookingAssetError(tenantId,locationId,body.bookingAssetId,scheduledStart,durationMin);if(assetMessage&&(assetMessage==='Booking asset is unavailable.'||!await approvedScheduling(request,assetMessage)))return NextResponse.json(assetMessage==='Booking asset is unavailable.'?{error:assetMessage}:schedulingWarning(assetMessage),{status:409});
    const rules = await checkCustomerBookingRules(tenantId, source.customerId, scheduledStart, durationMin,source.pets.map(p=>p.petId));
    const nearby=rules.conflicts.length?'Appointment spacing warning: '+rules.conflicts.map(c=>c.message).join('\n'):'';
    if(nearby&&!await approvedScheduling(request,nearby))return NextResponse.json(schedulingWarning(nearby),{status:409});

    if (groomerId) {
      const groomer = await db.user.findFirst({ where: { id: groomerId, tenantId, active: true, OR: [{ locationId }, { locationId: null }] }, select: { id: true } });
      if(groomer&&!await employeeAvailable(tenantId,groomerId,locationId,scheduledStart,durationMin))if(!await approvedScheduling(request,'Choose an available groomer or Assign later.'))return NextResponse.json(schedulingWarning('Choose an available groomer or Assign later.'),{status:409});
      if (!groomer) return NextResponse.json({ error: "Selected groomer could not be found." }, { status: 404 });
    }

    const intervalWeeks=(+scheduledStart-+new Date(source.scheduledStart||source.createdAt))/(7*86400000);
    let discountPct = 0;
    let discountLabel = "Automatic return-visit discount";
    const requestedOverride = body.discountOverridePct == null ? null : Number(body.discountOverridePct);
    if (requestedOverride != null) {
      if (!Number.isFinite(requestedOverride) || requestedOverride < 0 || requestedOverride > 100) return NextResponse.json({ error: "Invalid rebooking discount." }, { status: 400 });
      if (!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session.user.role) && session.user.role !== "MANAGER") return NextResponse.json({ error: "Only a manager can extend or change the rebooking discount." }, { status: 403 });
      discountPct = requestedOverride;
      discountLabel = requestedOverride === 20 && intervalWeeks <= 3 ? "Manager-Extended Touchup Groom/Bath" : "Manager Rebooking Discount";
    }

    let orderNumber=0;
    const eligibleSourceLines=mainRebookingLineIds(source);
    const serviceLines = source.lines.filter(line => line.lineType === "SERVICE"&&!isPrepaidPurchaseLine(line));

    const created = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
      orderNumber=await nextTicketNumber(tx,tenantId);
      const ticket = await tx.ticket.create({
        data: {
          id:offlineCreateId(), tenantId, locationId, customerId: source.customerId, orderNumber, scheduledStart, durationMin,timingMode:businessMode,
          bookingAssetId:body.bookingAssetId||null,status: "OPEN", bookingSource: "STAFF", bookingDecision: "INTERNAL", notes: source.notes,
          pets: { create: source.pets.map(p => ({ petId: p.petId, weightLbs: p.weightLbs, analSituation: null, vipAvailability: p.vipAvailability })) },
          lines: { create: serviceLines.map((line, index) => {
            const eligible = eligibleSourceLines.has(line.id);
            const gross = line.unitPriceCents * line.quantity;
            const discountCents = eligible && discountPct > 0 ? Math.round(gross * discountPct / 100) : 0;
            const totalCents = gross - discountCents;
            return {id:offlineLineId(index),sourceKey:line.sourceKey,durationMin:line.durationMin,reportCardDescription:line.reportCardDescription,packageId:line.packageId,packageGroupKey:line.packageGroupKey,packageName:line.packageName, lineType: "SERVICE", role: line.role, serviceId: line.serviceId, petId: line.petId, description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents, discountCents, totalCents, commissionPct: line.commissionPct, commissionCents: Math.round(totalCents * Number(line.commissionPct || 0) / 100), sortOrder: index, assignedUserId: null, assignedAt: null };
          }) },
          ...(groomerId ? { assignments: { create: [{ userId: groomerId, role: "GROOMER" },{userId:groomerId,role:"PLANNED_GROOMER"}] } } : {})
        },
        include: { customer: true, pets: { include: { pet: true } }, lines: { include: { pet: true, service: true } }, assignments: { include: { user:{select:{id:true,firstName:true,lastName:true,role:true,active:true}} } } }
      });
      await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: ticket.id, actorUserId: session.user.id, changeType: "CREATED", previousStart: null, newStart: scheduledStart } });
      await ensureGroomingNotes(tx,ticket,session.user.id);
      await queueInitialAttendanceRequest(tx,ticket);
      if(requestedOverride!=null){const settingKey='REBOOKING_DISCOUNT:'+ticket.id;await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value:{managerOverride:true}},update:{value:{managerOverride:true}}});}
      const result=await refreshRebookingDiscounts(tx,tenantId,ticket.id,session.user.id);
      if(result.percentByPet)discountPct=Math.max(0,...Object.values(result.percentByPet));
      ticket.lines=await tx.ticketLine.findMany({where:{ticketId:ticket.id},include:{pet:true,service:true}});
      ticket.totalCents=ticket.lines.reduce((sum,line)=>sum+line.totalCents,0)+ticket.salesTaxCents+ticket.tipCents;
      await tx.ticket.update({where:{id:ticket.id},data:{totalCents:ticket.totalCents}});
      return ticket;
    });

    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: created.id, customerId: source.customerId, action: "REBOOK", summary: `Rebooked ticket #${source.orderNumber} as appointment #${orderNumber}.`, details: { sourceTicketId: source.id, scheduledStart: scheduledStart.toISOString(), groomerId, rebookingDiscountPct: discountPct, rebookingDiscountLabel: discountLabel, intervalWeeks: intervalWeeks } });
    return NextResponse.json({ ticket: created, warnings: rules.conflicts, rebookingDiscount: { pct: discountPct, label: discountLabel, intervalWeeks: intervalWeeks } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to rebook appointment." }, { status: 400 });
  }
}


