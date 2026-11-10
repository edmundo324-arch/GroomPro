import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { getActiveEmployeeSession } from '@/src/lib/employee-session';
import { requestLocation } from '@/src/lib/request-location';
import { hidePlatformOwners, withRequestPolicy } from '@/src/lib/request-policy';

async function staff(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || request.cookies.get('groompro_tenant')?.value || process.env.GROOMPRO_DEV_TENANT_ID || '';
  const sid = request.cookies.get('groompro_session')?.value;
  if (!sid || !await getActiveEmployeeSession(tenantId, sid)) return NextResponse.json({ error: 'Employee PIN is required.' }, { status: 401 });
  const locationId = await requestLocation(request, tenantId);
  if (!locationId) return NextResponse.json({ error: 'Choose a location.' }, { status: 400 });
  const employees = await db.user.findMany({
    where: { tenantId,...(await hidePlatformOwners(request,tenantId)?{role:{not:'PLATFORM_OWNER' as const}}:{}), active: true, OR: [{ locationId }, { locationId: null }] },
    select: { id: true, firstName: true, lastName: true, displayName: true, role: true, active: true, jobTitle: true },
  });
  return NextResponse.json({ employees }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(staff, { feature: 'TICKETS' });
