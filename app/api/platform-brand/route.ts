import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { platformSession } from '@/src/lib/platform-access';
import { withRequestPolicy } from '@/src/lib/request-policy';

const id = 'groompro-platform-brand';
async function read() {
  const row = await db.tenantSetting.findUnique({ where: { id }, select: { value: true } });
  const name = (row?.value as { name?: string } | null)?.name || 'GroomPro Suite';
  return NextResponse.json({ name }, { headers: { 'Cache-Control': 'no-store' } });
}

async function save(request: NextRequest) {
  const session = await platformSession(request);
  if (session?.user.role !== 'PLATFORM_OWNER') {
    return NextResponse.json({ error: 'Only the platform Owner can change the product name.' }, { status: 403 });
  }
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) return NextResponse.json({ error: 'Enter a product name of 1 to 60 characters.' }, { status: 400 });
  await db.tenantSetting.upsert({
    where: { id }, create: { id, tenantId: session.user.tenantId, settingKey: 'PLATFORM_BRAND', value: { name } },
    update: { value: { name } }
  });
  return NextResponse.json({ name });
}

export const GET = withRequestPolicy(read, {});
export const PUT = withRequestPolicy(save, {});
