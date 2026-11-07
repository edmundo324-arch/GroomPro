import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { platformSession } from '@/src/lib/platform-access';
import { withRequestPolicy } from '@/src/lib/request-policy';
import { workflowSettings } from '@/src/lib/workflow-settings';
import { calendarDeviceKinds, calendarWidths, employeeCalendarPolicy } from '@/src/lib/calendar-preferences';

async function preferences(request: NextRequest) {
  const session = await platformSession(request);
  if (!session) return NextResponse.json({ error: 'Employee sign-in is required.' }, { status: 401 });
  const { id: employeeId, tenantId } = session.user;
  const input = request.method === 'GET' ? Object.fromEntries(request.nextUrl.searchParams) : await request.json();
  const { deviceId, deviceKind, width } = input;
  if (input.employeeId !== employeeId || typeof deviceId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(deviceId) || !calendarDeviceKinds.includes(deviceKind)) {
    return NextResponse.json({ error: 'Invalid Calendar device.' }, { status: 400 });
  }
  const [employee, settings] = await Promise.all([
    db.user.findUnique({ where: { id: employeeId }, select: { jobTitle: true } }),
    workflowSettings(tenantId)
  ]);
  const policy = employeeCalendarPolicy(settings.posLayout?.calendarPreferences, employee?.jobTitle ?? null, deviceKind);
  const key = { tenantId, settingKey: `CALENDAR_DEVICE:${employeeId}:${deviceKind}:${deviceId}` };
  if (request.method === 'PUT') {
    if (!policy.remember || !calendarWidths.includes(width)) return NextResponse.json({ ...policy, saved: false });
    await db.tenantSetting.upsert({
      where: { tenantId_settingKey: key }, create: { ...key, value: { width } }, update: { value: { width } }
    });
    return NextResponse.json({ ...policy, saved: true });
  }
  const stored = policy.remember ? await db.tenantSetting.findUnique({ where: { tenantId_settingKey: key } }) : null;
  const saved = (stored?.value as { width?: string } | null)?.width;
  return NextResponse.json({ ...policy, width: saved && calendarWidths.includes(saved) ? saved : null }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withRequestPolicy(preferences, { feature: 'CALENDAR' });
export const PUT = withRequestPolicy(preferences, { feature: 'CALENDAR' });
