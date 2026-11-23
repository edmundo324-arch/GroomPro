import {localToInstant,zonedParts} from '@/src/lib/operating-hours';
import {requestLocation} from '@/src/lib/request-location';
import {recordStaffAttendance} from '@/src/lib/customer-attendance';
import {workflowSettings} from '@/src/lib/workflow-settings';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const COOKIE = "groompro_session";
const ALLOWED = ["OPEN", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "READY", "CLOSED", "CANCELLED"] as const;
type Status = typeof ALLOWED[number];
function tenantFrom(r: NextRequest) { return r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

async function updateStatus(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const sid = request.cookies.get(COOKIE)?.value || "";
  const session = tenantId && sid ? await getActiveEmployeeSession(tenantId, sid) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing ticket status." }, { status: 401 });
  try {
    const body = await request.json();
    const ticketId = String(body.ticketId || "");
    const status = String(body.status || "") as Status;
    if (!ticketId || (!ALLOWED.includes(status)&&!["UNDO_CHECK_IN","UNDO_READY"].includes(body.action))) return NextResponse.json({ error: "Ticket and valid status are required." }, { status: 400 });

    const noticeLocation=body.expectedPickupAt?await requestLocation(request,tenantId):undefined;
    if(body.expectedPickupAt&&!noticeLocation)return NextResponse.json({error:"Choose the assigned shop before undoing completion."},{status:400});
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, tenantId,...(noticeLocation?{locationId:noticeLocation}:{}) },
      select: { id: true, tenantId: true, locationId: true, customerId: true, status: true, displayStatus:true, orderNumber: true, scheduledStart: true, checkedInAt: true, arrivalPriority: true, pickupAt: true, pickupCompletedAt: true, closedAt: true }
    });
    if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
    if(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TICKET_VOID:'+ticket.id}}}))return NextResponse.json({error:'This ticket was voided. Its history is retained and its status cannot be changed.'},{status:409});
    if (ticket.status === "CLOSED" && status !== "CLOSED") return NextResponse.json({ error: "A closed ticket cannot be reopened." }, { status: 409 });
    if (ticket.status === "CANCELLED" && status !== "CANCELLED") return NextResponse.json({ error: "A cancelled ticket cannot be reopened." }, { status: 409 });

    if(['UNDO_CHECK_IN','UNDO_READY'].includes(body.action)){
      if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))return NextResponse.json({error:'This visit cannot be changed.'},{status:409});
      let restoreDisplayStatus:string|null=null;
      let restoreStatus:Status=ticket.checkedInAt?'CHECKED_IN':'CONFIRMED';
      if(body.action==='UNDO_READY'&&body.expectedPickupAt){
       if(ticket.status!=='READY'||!ticket.pickupAt||+ticket.pickupAt!==Date.parse(body.expectedPickupAt))return NextResponse.json({error:'This completion has already changed. Refresh the notice before undoing it.'},{status:409});
       const event=await db.auditEntry.findFirst({where:{tenantId,entityType:'TICKET',entityId:ticket.id,action:'STATUS_CHANGE',occurredAt:{gte:ticket.pickupAt}},orderBy:{occurredAt:'desc'}});
       const prior=(event?.details as any)?.previousStatus;if(['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS'].includes(prior)){restoreStatus=prior;restoreDisplayStatus=(event?.details as any)?.previousDisplayStatus||null;}
      }
      const data=body.action==='UNDO_CHECK_IN'?{status:'CONFIRMED' as const,checkedInAt:null,arrivalPriority:null,pickupAt:null}:{status:restoreStatus,displayStatus:restoreDisplayStatus,pickupAt:null};
      const updated=await db.ticket.update({where:{id:ticket.id,status:ticket.status,...(body.expectedPickupAt?{pickupAt:ticket.pickupAt}:{})},data});await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:body.action,summary:body.action==='UNDO_CHECK_IN'?'Reversed check-in.':'Reversed ready for pickup.'});return NextResponse.json({ticket:updated});
    }
    if(status==="CLOSED")return NextResponse.json({error:"Use Check Out / Close so payment and earnings are finalized together."},{status:409});
    const now = new Date();
    let updated;
    let assignedArrivalPriority: number | null = ticket.arrivalPriority;

    if(status==='CONFIRMED'&&body.recordAttendance===true){
      updated=await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;
        const live=await tx.ticket.findFirst({where:{id:ticket.id,tenantId}});if(!live||['CLOSED','CANCELLED','NO_SHOW'].includes(live.status))throw Error('This appointment changed. Reopen it before confirming.');
        const saved=await tx.ticket.update({where:{id:live.id,status:live.status},data:{status}});
        await recordStaffAttendance(tx,live,session.user.id);return saved;
      });
    } else if (status === "CHECKED_IN" && (!ticket.checkedInAt || !ticket.arrivalPriority)) {
      updated = await db.$transaction(async tx => {
        // Serialize arrival numbers at this shop, including simultaneous devices.
        await tx.$queryRaw`SELECT id FROM Location WHERE id=${ticket.locationId} AND tenantId=${tenantId} FOR UPDATE`;
        const live=await tx.ticket.findFirst({where:{id:ticket.id,tenantId}});
        if(!live||['CLOSED','CANCELLED','NO_SHOW'].includes(live.status))throw Error('This appointment changed. Reopen it before checking in.');
        if(live.checkedInAt&&live.arrivalPriority){assignedArrivalPriority=live.arrivalPriority;return tx.ticket.update({where:{id:live.id,status:live.status},data:{status}});}
        const location=await tx.location.findFirst({where:{id:ticket.locationId,tenantId},select:{timezone:true}});
        const zone=location?.timezone||'America/Chicago',day=zonedParts(live.scheduledStart||now,zone).date;
        const next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
        const start=localToInstant(day+'T00:00',zone),end=localToInstant(next.toISOString().slice(0,10)+'T00:00',zone);
        const max = await tx.ticket.aggregate({
          where: { tenantId, locationId: ticket.locationId, scheduledStart: { gte: start, lt: end }, arrivalPriority: { not: null }, id: { not: ticket.id } },
          _max: { arrivalPriority: true }
        });
        assignedArrivalPriority = (max._max.arrivalPriority || 0) + 1;
        return tx.ticket.update({ where: { id: live.id, status: live.status }, data: { status, checkedInAt: live.checkedInAt || now, arrivalPriority: assignedArrivalPriority } });
      });
    } else {
      const data: { status: Status; checkedInAt?: Date | null; pickupAt?: Date | null; pickupCompletedAt?: Date | null; closedAt?: Date | null } = { status };
      if (status === "CHECKED_IN" && !ticket.checkedInAt) data.checkedInAt = now;
      if (status === "READY" && ticket.status!=="READY") data.pickupAt = now;
      if(ticket.status==="READY"&&status!=="READY")data.pickupAt=null;

      updated = await db.ticket.update({ where: { id: ticket.id, status: ticket.status }, data });
    }

    await writeAudit({
      tenantId,
      actorUserId: session.user.id,
      entityType: "TICKET",
      entityId: ticket.id,
      customerId: ticket.customerId,
      action: "STATUS_CHANGE",
      summary: `Changed ticket #${ticket.orderNumber} from ${ticket.status} to ${status}.`,
      details: { previousStatus: ticket.status, previousDisplayStatus:ticket.displayStatus, newStatus: status, arrivalPriority: assignedArrivalPriority, autoAssignedArrivalPriority: status === "CHECKED_IN" && !ticket.checkedInAt }
    });
    return NextResponse.json({ ticket: updated, arrivalPriority: assignedArrivalPriority });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to change ticket status." }, { status: 400 });
  }
}

export async function PATCH(request:NextRequest){const tenantId=tenantFrom(request);const body=await request.clone().json().catch(()=>null);if(!body)return NextResponse.json({error:'Invalid status request.'},{status:400});const settings=await workflowSettings(tenantId),custom=settings.customStatuses.includes(body.status);const payload=custom?{...body,status:settings.customStatusStages[body.status]||'OPEN',recordAttendance:false}:{...body,recordAttendance:body.status==='CONFIRMED'&&!body.action};const response=await updateStatus(new NextRequest(request.url,{method:'PATCH',headers:request.headers,body:JSON.stringify(payload)}));if(response.ok){const data=await response.json();await db.ticket.updateMany({where:{id:body.ticketId,tenantId,status:data.ticket?.status},data:{displayStatus:body.action==='UNDO_READY'?data.ticket?.displayStatus||null:custom?body.status:null}});return NextResponse.json({...data,...(data.ticket?{ticket:{...data.ticket,displayStatus:body.action==='UNDO_READY'?data.ticket?.displayStatus||null:custom?body.status:null}}:{})},{status:response.status})}return response}

