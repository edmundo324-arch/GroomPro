import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { platformSession } from '@/src/lib/platform-access';
import { requestLocation } from '@/src/lib/request-location';
import { withRequestPolicy } from '@/src/lib/request-policy';
import { pickupCallAction, pickupCallTime } from '@/src/lib/pickup-call';

async function history(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 401 });
  const { tenantId } = session.user;
  const locationId = await requestLocation(request, tenantId);
  const id = request.nextUrl.searchParams.get('id') || '';
  const ticket = locationId && id ? await db.ticket.findFirst({ where: { id, tenantId, locationId }, select: { id: true } }) : null;
  if (!ticket) return NextResponse.json({ error: 'Ticket not found at this location.' }, { status: 404 });
  const entries = await db.auditEntry.findMany({
    where: { tenantId, entityType: 'TICKET', entityId: id, action: { in: ['STATUS_CHANGE', 'UNDO_CHECK_IN', 'UNDO_READY', 'CLOSE', pickupCallAction] } },
    select: { action: true, details: true, occurredAt: true }, orderBy: { occurredAt: 'desc' }, take: 100
  });
  const labels: Record<string, string> = { CHECKED_IN: 'Checked in', READY: 'Ready for pickup', UNDO_CHECK_IN: 'Check-in reversed', UNDO_READY: 'Ready status reversed', CLOSE: 'Pickup completed', [pickupCallAction]: 'Pickup call recorded' };
  const events = entries.flatMap(entry => {
    const key = entry.action === 'STATUS_CHANGE' ? (entry.details as { newStatus?: string } | null)?.newStatus : entry.action;
    return key && labels[key] ? [{ label: labels[key], at: key===pickupCallAction?pickupCallTime(entry):entry.occurredAt }] : [];
  });
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(history, { feature: 'TICKETS' });

async function recordCall(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 401 });
  const { tenantId, id: actorUserId } = session.user;
  const locationId = await requestLocation(request, tenantId);
  const body = await request.json().catch(() => null);
  const ticketId = body?.ticketId;
  if (!locationId || typeof ticketId !== 'string' || !ticketId || ticketId.length > 191) {
    return NextResponse.json({ error: 'Choose a ticket at this location.' }, { status: 400 });
  }
  const result = await db.$transaction(async tx => {
    const [ticket] = await tx.$queryRaw<{status:string;pickupAt:Date|null;pickupCompletedAt:Date|null;customerId:string}[]>`SELECT status,pickupAt,pickupCompletedAt,customerId FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} AND locationId=${locationId} FOR UPDATE`;
    if (!ticket) return { error: 'Ticket not found at this location.', status: 404 };
    if (ticket.status !== 'READY' || !ticket.pickupAt || ticket.pickupCompletedAt) {
      return { error: 'Mark the ticket ready for pickup before recording a call.', status: 409 };
    }
    const previous = await tx.auditEntry.findFirst({
      where:{tenantId,entityType:'TICKET',entityId:ticketId,action:pickupCallAction,occurredAt:{gte:ticket.pickupAt}},
      orderBy:{occurredAt:'desc'},select:{occurredAt:true,details:true}
    });
    if (previous) return { pickupCalledAt: pickupCallTime(previous) };
    const clientTime = typeof body.calledAt === 'string' ? Date.parse(body.calledAt) : NaN;
    const calledAt = request.headers.has('x-groompro-offline') && Number.isFinite(clientTime) && clientTime <= Date.now()+300000
      ? new Date(clientTime).toISOString() : new Date().toISOString();
    const entry = await tx.auditEntry.create({
      data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,
        action:pickupCallAction,summary:'Recorded a pickup call.',details:{calledAt}},
      select:{occurredAt:true,details:true}
    });
    return { pickupCalledAt: pickupCallTime(entry) };
  });
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result);
}

export const PATCH = withRequestPolicy(recordCall, { feature: 'TICKETS' });
