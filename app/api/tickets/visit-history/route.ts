import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { platformSession } from '@/src/lib/platform-access';
import { requestLocation } from '@/src/lib/request-location';
import { withRequestPolicy } from '@/src/lib/request-policy';

async function history(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 401 });
  const { tenantId } = session.user;
  const locationId = await requestLocation(request, tenantId);
  const id = request.nextUrl.searchParams.get('id') || '';
  const ticket = locationId && id ? await db.ticket.findFirst({ where: { id, tenantId, locationId }, select: { id: true } }) : null;
  if (!ticket) return NextResponse.json({ error: 'Ticket not found at this location.' }, { status: 404 });
  const entries = await db.auditEntry.findMany({
    where: { tenantId, entityType: 'TICKET', entityId: id, action: { in: ['STATUS_CHANGE', 'UNDO_CHECK_IN', 'UNDO_READY', 'CLOSE'] } },
    select: { action: true, details: true, occurredAt: true }, orderBy: { occurredAt: 'desc' }, take: 100
  });
  const labels: Record<string, string> = { CHECKED_IN: 'Checked in', READY: 'Ready for pickup', UNDO_CHECK_IN: 'Check-in reversed', UNDO_READY: 'Ready status reversed', CLOSE: 'Pickup completed' };
  const events = entries.flatMap(entry => {
    const key = entry.action === 'STATUS_CHANGE' ? (entry.details as { newStatus?: string } | null)?.newStatus : entry.action;
    return key && labels[key] ? [{ label: labels[key], at: entry.occurredAt }] : [];
  });
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(history, { feature: 'TICKETS' });
