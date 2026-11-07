import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { platformSession } from '@/src/lib/platform-access';
import { requestLocation } from '@/src/lib/request-location';
import { withRequestPolicy } from '@/src/lib/request-policy';
import { localToInstant, zonedParts } from '@/src/lib/operating-hours';
import { plannedSettingKey } from '@/src/lib/planned-package-store';
import { lineStartsKey } from '@/src/lib/line-time-store';
import { plannedCalendarCard } from '@/src/lib/planned-package-rules';
import { petSchedule } from '@/src/lib/pet-scheduling';

async function mapAppointments(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee PIN is required.' }, { status: 401 });
  const { id, tenantId, role } = session.user;
  const date = request.nextUrl.searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Choose a Calendar date.' }, { status: 400 });
  const locationId = await requestLocation(request, tenantId);
  const location = locationId && await db.location.findFirst({ where: { id: locationId, tenantId }, select: { id: true, timezone: true } });
  if (!location) return NextResponse.json({ error: 'Choose a location.' }, { status: 400 });
  const timezone = location.timezone || 'America/Chicago';
  let start: Date, end: Date;
  try {
    start = localToInstant(date + 'T00:00', timezone);
    const following = new Date(date + 'T12:00:00Z');
    following.setUTCDate(following.getUTCDate() + 1);
    end = localToInstant(following.toISOString().slice(0, 10) + 'T00:00', timezone);
  } catch {
    return NextResponse.json({ error: 'Choose a valid Calendar date.' }, { status: 400 });
  }
  const indexes = await db.tenantSetting.findMany({
    where: { tenantId, settingKey: { startsWith: `CALENDAR_DATE:${location.id}:${date}:` } }, select: { value: true }
  });
  const indexedIds = indexes.flatMap(row => {
    const ticketId = (row.value as { ticketId?: string } | null)?.ticketId;
    return typeof ticketId === 'string' ? [ticketId] : [];
  });
  const tickets = await db.ticket.findMany({
    where: { tenantId, locationId: location.id, status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      OR: [{ scheduledStart: { gte: start, lt: end } }, { id: { in: indexedIds } }] },
    include: {
      assignments: { select: { role: true, userId: true } }, lines: true,
      pets: { select: { pet: { select: { id: true, name: true } } } },
      customer: { select: { firstName: true, lastName: true, address1: true, address2: true, city: true, state: true, postalCode: true } }
    }
  });
  const rows = await db.tenantSetting.findMany({
    where: { tenantId, settingKey: { in: tickets.flatMap(ticket => [plannedSettingKey(ticket.id), lineStartsKey(ticket.id)]) } },
    select: { settingKey: true, value: true }
  });
  const settings = new Map(rows.map(row => [row.settingKey, row.value]));
  const all = ['PLATFORM_OWNER', 'DEVELOPER', 'ADMIN', 'MANAGER', 'FLOOR_MANAGER'].includes(role);
  const appointments = tickets.flatMap(ticket => {
    const ticketPlans = settings.get(plannedSettingKey(ticket.id)) as { items?: any[] } | undefined;
    const full = { ...ticket, plannedAssignments: ticketPlans?.items || [], lineStarts: (settings.get(lineStartsKey(ticket.id)) || {}) as Record<string, string> };
    const visible = all ? full : plannedCalendarCard(full, id, new Set([id]));
    if (!visible?.scheduledStart) return [];
    const visits = visible.pets.map(entry => ({ name: entry.pet.name, start: petSchedule(full, entry.pet.id).start }))
      .filter(visit => zonedParts(visit.start, timezone).date === date)
      .sort((a, b) => +a.start - +b.start);
    if (!visits.length && (visible.pets.length || +visible.scheduledStart < +start || +visible.scheduledStart >= +end)) return [];
    const c = visible.customer;
    return [{
      id: visible.id, orderNumber: visible.orderNumber, scheduledStart: visits[0]?.start || visible.scheduledStart,
      customer: [c.firstName, c.lastName].filter(Boolean).join(' '), pets: visits.map(visit => visit.name),
      address: c.address1 ? [c.address1, c.address2, c.city, c.state, c.postalCode].filter(Boolean).join(', ') : ''
    }];
  }).sort((a, b) => +a.scheduledStart - +b.scheduledStart);
  return NextResponse.json({ appointments, timezone, all }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(mapAppointments, { feature: 'CALENDAR' });
