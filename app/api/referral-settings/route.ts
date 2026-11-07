import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { managerAction } from '@/src/lib/protected-action';
import { withRequestPolicy } from '@/src/lib/request-policy';
import { referralCreditKey, referralCreditCents } from '@/src/lib/customer-referrals';
const tenant = (request: NextRequest) => request.headers.get('x-tenant-id') || request.cookies.get('groompro_tenant')?.value || process.env.GROOMPRO_DEV_TENANT_ID || '';
export const GET = withRequestPolicy(async request => NextResponse.json({ amountCents: await referralCreditCents(tenant(request)) }), { feature: 'CUSTOMERS' });
export const PUT = withRequestPolicy(managerAction(async request => {
  const tenantId = tenant(request);
  const input = await request.json().catch(() => null);
  const amountCents = input?.amountCents;
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 100000) {
    return NextResponse.json({ error: 'Enter a credit from $0.00 to $1,000.00.' }, { status: 400 });
  }
  const key = { tenantId, settingKey: referralCreditKey };
  await db.tenantSetting.upsert({ where: { tenantId_settingKey: key }, create: { ...key, value: amountCents }, update: { value: amountCents } });
  return NextResponse.json({ amountCents });
}), { feature: 'CUSTOMERS', configure: true });
