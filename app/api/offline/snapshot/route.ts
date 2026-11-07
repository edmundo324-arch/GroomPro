import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { getActiveEmployeeSession } from '@/src/lib/employee-session';
import { requestLocation } from '@/src/lib/request-location';
import { withRequestPolicy } from '@/src/lib/request-policy';
import { moduleDenial } from '@/src/lib/module-entitlement';
import { localToInstant, zonedParts } from '@/src/lib/operating-hours';
import { attendingPets } from '@/src/lib/appointment-pets';
import { lineStartsKey } from '@/src/lib/line-time-store';
import { customerReferrals } from '@/src/lib/customer-referrals';
import { plannedSettingKey } from '@/src/lib/planned-package-store';

async function snapshot(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || request.cookies.get('groompro_tenant')?.value || process.env.GROOMPRO_DEV_TENANT_ID || '';
  const sid = request.cookies.get('groompro_session')?.value;
  const session = sid && await getActiveEmployeeSession(tenantId, sid);
  if (!session) return NextResponse.json({ error: 'Employee PIN is required.' }, { status: 401 });
  for (const feature of ['CUSTOMERS', 'PETS', 'TICKETS', 'CALENDAR']) {
    const denial = await moduleDenial(request, feature);
    if (denial) return denial;
  }
  const locationId = await requestLocation(request, tenantId);
  const location = await db.location.findFirst({ where: { id: locationId, tenantId }, select: { id: true, name: true, timezone: true } });
  if (!location) return NextResponse.json({ error: 'Choose a business location.' }, { status: 400 });
  const timezone = location.timezone || 'America/Chicago';
  const now = new Date();
  const today = zonedParts(now, timezone).date;
  const day = new Date(today + 'T12:00:00Z');
  const past = new Date(day);
  past.setUTCDate(past.getUTCDate() - 16 * 7);
  const future = new Date(day);
  const targetDay = future.getUTCDate();
  future.setUTCDate(1);
  future.setUTCMonth(future.getUTCMonth() + 1);
  const lastOfMonth = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth() + 1, 0)).getUTCDate();
  future.setUTCDate(Math.min(targetDay, lastOfMonth) + 1);
  const start = localToInstant(today + 'T00:00', timezone);
  const since = localToInstant(past.toISOString().slice(0, 10) + 'T00:00', timezone);
  const through = localToInstant(future.toISOString().slice(0, 10) + 'T00:00', timezone);
  const customers = await db.customer.findMany({
    where: { tenantId, active: true, OR: [
      { lastVisit: { gte: since, lte: now } },
      { pets: { some: { lastVisit: { gte: since, lte: now } } } },
      { tickets: { some: { locationId, status: 'CLOSED', OR: [{ closedAt: { gte: since, lte: now } }, { scheduledStart: { gte: since, lte: now } }] } } },
      { tickets: { some: { locationId, scheduledStart: { gte: start, lt: through } } } },
    ] },
    include: { phones: { orderBy: { isPrimary: 'desc' } }, pets: { include: { vaccinations: true }, orderBy: { name: 'asc' } }, communications: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
  });
  const customerIds = customers.map(customer => customer.id);
  const staffFields = { id: true, displayName: true, firstName: true, lastName: true, role: true, active: true } as const;
  const [tickets, notes, drafts, referrals] = await Promise.all([
    db.ticket.findMany({
      where: { tenantId, customerId: { in: customerIds }, OR: [{ scheduledStart: { lt: through } }, { scheduledStart: null }] },
      include: { pets: { include: { pet: true } }, lines: { include: { pet: true, service: true, product: true, assignedUser: { select: staffFields } } },
        assignments: { include: { user: { select: staffFields } } },
        payments: { select: { id: true, amount: true, paymentType: true, paidAt: true } },
        scheduleHistory: { include: { actor: { select: staffFields } }, orderBy: { changedAt: 'asc' } },
      },
      orderBy: [{ scheduledStart: 'desc' }, { createdAt: 'desc' }],
    }),
    db.groomingNote.findMany({ where: { tenantId, customerId: { in: customerIds } }, orderBy: [{ appointmentAt: 'desc' }, { createdAt: 'desc' }] }),
    db.posDraft.findMany({ where: { tenantId, locationId, promotedAt: null } }),
    customerReferrals(tenantId, customerIds),
  ]);
  const settings = await db.tenantSetting.findMany({ where: { tenantId, settingKey: { in: tickets.flatMap(ticket => [lineStartsKey(ticket.id), plannedSettingKey(ticket.id)]) } }, select: { settingKey: true, value: true } });
  const values = new Map(settings.map(entry => [entry.settingKey, entry.value]));
  const records = tickets.map(ticket => ({ ...attendingPets(ticket), lineStarts: values.get(lineStartsKey(ticket.id)) || {}, plannedAssignments: (values.get(plannedSettingKey(ticket.id)) as { items?: unknown } | undefined)?.items || [] }));
  return NextResponse.json({
    scope: { tenantId, locationId, employeeId: session.user.id },
    employee: { id: session.user.id, displayName: session.user.displayName, firstName: session.user.firstName, lastName: session.user.lastName, role: session.user.role },
    location, start, since, through, customers: customers.map(customer => ({ ...customer, ...referrals.get(customer.id) })), tickets: records, notes, drafts, fetchedAt: Date.now(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(snapshot, { feature: 'CUSTOMERS' });
