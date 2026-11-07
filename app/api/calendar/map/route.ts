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
import { orderDrivingStops } from '@/src/lib/route-distance';

const allowedAll = ['PLATFORM_OWNER', 'DEVELOPER', 'ADMIN', 'MANAGER', 'FLOOR_MANAGER'];
const addressFields = { address1: true, address2: true, city: true, state: true, postalCode: true } as const;
function address(place: Record<keyof typeof addressFields, string | null>) {
  return place.address1 ? Object.keys(addressFields).map(key => place[key as keyof typeof addressFields]).filter(Boolean).join(', ').replaceAll('|', ' ') : '';
}
function dateValue(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}
const routeKey = (location: string, employee: string) => 'MAP_ROUTE:' + location + ':' + employee;
const headers = { 'Cache-Control': 'no-store' };

async function mapAppointments(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee PIN is required.' }, { status: 401 });
  const { id, tenantId, role } = session.user;
  const params = request.nextUrl.searchParams;
  const date = params.get('date') || params.get('from') || '';
  const through = params.get('through') || date;
  const following = dateValue(through);
  if (!dateValue(date) || !following || through < date) return NextResponse.json({ error: 'Choose a valid Calendar date range.' }, { status: 400 });
  following.setUTCDate(following.getUTCDate() + 1);
  const endDay = following.toISOString().slice(0, 10);
  const locationId = await requestLocation(request, tenantId);
  const location = locationId && await db.location.findFirst({ where: { id: locationId, tenantId }, select: { id: true, timezone: true, ...addressFields } });
  if (!location) return NextResponse.json({ error: 'Choose a location.' }, { status: 400 });
  const timezone = location.timezone || 'America/Chicago';
  let start: Date, end: Date;
  try {
    start = localToInstant(date + 'T00:00', timezone);
    end = localToInstant(endDay + 'T00:00', timezone);
  } catch {
    return NextResponse.json({ error: 'Choose a valid Calendar date.' }, { status: 400 });
  }
  const prefix = `CALENDAR_DATE:${location.id}:`;
  const indexes = await db.tenantSetting.findMany({
    where: { tenantId, settingKey: { gte: prefix + date, lt: prefix + endDay } }, select: { value: true }
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
  const canSeeAll = allowedAll.includes(role);
  const all = canSeeAll && params.get('scope') !== 'mine';
  const appointments = tickets.flatMap(ticket => {
    const ticketPlans = settings.get(plannedSettingKey(ticket.id)) as { items?: any[] } | undefined;
    const full = { ...ticket, plannedAssignments: ticketPlans?.items || [], lineStarts: (settings.get(lineStartsKey(ticket.id)) || {}) as Record<string, string> };
    const visible = all ? full : plannedCalendarCard(full, id, new Set([id]));
    if (!visible?.scheduledStart) return [];
    const visits = visible.pets.map(entry => ({ name: entry.pet.name, start: petSchedule(full, entry.pet.id).start }))
      .filter(visit => +visit.start >= +start && +visit.start < +end)
      .sort((a, b) => +a.start - +b.start);
    if (!visits.length && (visible.pets.length || +visible.scheduledStart < +start || +visible.scheduledStart >= +end)) return [];
    const c = visible.customer;
    const days = new Map<string, typeof visits>();
    for (const visit of visits) {
      const day = zonedParts(visit.start, timezone).date;
      const group = days.get(day);
      if (group) group.push(visit); else days.set(day, [visit]);
    }
    if (!days.size) days.set(zonedParts(visible.scheduledStart, timezone).date, []);
    return [...days].map(([day, group]) => ({
      day, id: visible.id, orderNumber: visible.orderNumber, scheduledStart: group[0]?.start || visible.scheduledStart,
      customer: [c.firstName, c.lastName].filter(Boolean).join(' '), pets: group.map(visit => visit.name), address: address(c),
    }));
  }).sort((a, b) => +a.scheduledStart - +b.scheduledStart);
  const setting = await db.tenantSetting.findUnique({ where: { tenantId_settingKey: { tenantId, settingKey: routeKey(locationId, id) } } });
  const saved = setting?.value as { origin?: string; destination?: string } | undefined;
  const shop = address(location);
  const origin = saved?.origin || shop;
  const destination = saved?.destination || shop;
  const optimize = Boolean(origin && destination && (origin !== shop || destination !== shop));
  const routesKey = process.env.GROOMPRO_GOOGLE_ROUTES_KEY;
  if (params.get('route') === '1') {
    if (date !== through) return NextResponse.json({ error: 'Select one day to calculate its driving route.' }, { status: 400, headers });
    const stops = [...new Set(appointments.map(visit => visit.address).filter(Boolean))];
    if (!optimize || stops.length < 2) return NextResponse.json({ stops }, { headers });
    if (!routesKey) return NextResponse.json({ error: 'Driving-distance order needs the Google Routes API key.' }, { status: 503, headers });
    try {
      return NextResponse.json({ stops: await orderDrivingStops(origin, destination, stops, routesKey, request.signal) }, { headers });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502, headers });
    }
  }
  return NextResponse.json({ appointments, timezone, all, canSeeAll, shop, origin, destination, optimize,
    embedKey: process.env.GROOMPRO_GOOGLE_MAPS_EMBED_KEY || '', routesConfigured: Boolean(routesKey),
  }, { headers });
}

export const GET = withRequestPolicy(mapAppointments, { feature: 'CALENDAR' });

async function saveAddresses(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee PIN is required.' }, { status: 401 });
  const { id, tenantId } = session.user;
  const locationId = await requestLocation(request, tenantId);
  if (!locationId) return NextResponse.json({ error: 'Choose a location.' }, { status: 400 });
  const input = await request.json().catch(() => null);
  if (!input || ![input.origin, input.destination].every(value => typeof value === 'string' && value.length <= 240 && !/[|\r\n]/.test(value))) {
    return NextResponse.json({ error: 'Enter a single-line starting and ending address.' }, { status: 400 });
  }
  const key = { tenantId, settingKey: routeKey(locationId, id) };
  const value = { origin: input.origin.trim(), destination: input.destination.trim() };
  await db.tenantSetting.upsert({ where: { tenantId_settingKey: key }, create: { ...key, value }, update: { value } });
  return NextResponse.json({ saved: true }, { headers });
}

export const PUT = withRequestPolicy(saveAddresses, { feature: 'CALENDAR' });
