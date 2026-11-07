import type { Prisma } from '@prisma/client';
import { db } from './db';
import { addAccountEntry } from './customer-account';

export const referralCreditKey = 'CUSTOMER_REFERRAL_CREDIT_CENTS';
export const defaultReferralCreditCents = 1000;
const referralKey = (customerId: string) => 'CUSTOMER_REFERRAL:' + customerId;
type Referral = { referralSource: string; referredById: string };
const paidGrooming: Prisma.TicketWhereInput = {
  status: 'CLOSED',
  payments: { some: { amount: { gt: 0 } } },
  lines: { some: { lineType: 'SERVICE', petId: { not: null }, totalCents: { gt: 0 }, OR: [
    { role: 'GROOM' },
    { service: { category: { in: ['GR', 'GROOM', 'GROOMING', 'FFT', 'FW', 'FULL WASH', 'FULL_WASH'] } } },
  ] } },
};

function referralValue(value: unknown): Referral {
  const data = value as Partial<Referral> | null;
  return { referralSource: typeof data?.referralSource === 'string' ? data.referralSource : '',
    referredById: typeof data?.referredById === 'string' ? data.referredById : '' };
}

export async function referralCreditCents(tenantId: string, client: Prisma.TransactionClient = db) {
  const setting = await client.tenantSetting.findUnique({ where: { tenantId_settingKey: { tenantId, settingKey: referralCreditKey } } });
  return typeof setting?.value === 'number' && Number.isSafeInteger(setting.value) && setting.value >= 0
    ? setting.value : defaultReferralCreditCents;
}

export async function customerReferrals(tenantId: string, customerIds: string[], client: Prisma.TransactionClient = db) {
  if (!customerIds.length) return new Map<string, Referral & { referredBy: string }>();
  const records = await client.tenantSetting.findMany({
    where: { tenantId, settingKey: { in: customerIds.map(referralKey) } }, select: { settingKey: true, value: true },
  });
  const values = records.map(record => [record.settingKey.slice('CUSTOMER_REFERRAL:'.length), referralValue(record.value)] as const);
  const referrerIds = [...new Set(values.map(([, referral]) => referral.referredById).filter(Boolean))];
  const referrers = referrerIds.length ? await client.customer.findMany({
    where: { tenantId, id: { in: referrerIds } }, select: { id: true, firstName: true, lastName: true },
  }) : [];
  const names = new Map(referrers.map(customer => [customer.id, customer.firstName + ' ' + customer.lastName]));
  return new Map(values.map(([id, referral]) => [id, { ...referral, referredBy: names.get(referral.referredById) || '' }]));
}

export async function saveCustomerReferral(tx: Prisma.TransactionClient, tenantId: string, customerId: string, input: Record<string, unknown>) {
  if (input.referralSource === undefined && input.referredById === undefined) return;
  const key = { tenantId, settingKey: referralKey(customerId) };
  const existing = referralValue((await tx.tenantSetting.findUnique({ where: { tenantId_settingKey: key } }))?.value);
  const read = (field: keyof Referral) => {
    const value = input[field];
    if (value === undefined) return existing[field];
    if (typeof value !== 'string' || value.trim().length > 191) throw Error('Enter valid referral information.');
    return value.trim();
  };
  const referredById = read('referredById');
  const referralSource = referredById ? 'Customer referral' : read('referralSource');
  if (referredById === customerId) throw Error('Choose a different customer as the referrer.');
  if (referredById && referredById !== existing.referredById &&
      !await tx.customer.findFirst({ where: { id: referredById, tenantId, active: true }, select: { id: true } })) {
    throw Error('Choose a referring customer from this business.');
  }
  if (referredById === existing.referredById && referralSource === existing.referralSource) return;
  const value = { referralSource, referredById };
  await tx.tenantSetting.upsert({ where: { tenantId_settingKey: key }, create: { ...key, value }, update: { value } });
}

export async function awardFirstGroomReferral(tx: Prisma.TransactionClient, ticket: { id: string; tenantId: string; customerId: string }, actorUserId: string) {
  const { tenantId, customerId, id: ticketId } = ticket;
  const referral = await tx.tenantSetting.findUnique({ where: { tenantId_settingKey: { tenantId, settingKey: referralKey(customerId) } } });
  const { referredById } = referralValue(referral?.value);
  if (!referredById || referredById === customerId) return 0;
  // Serialize two checkouts for the same new customer. Lock both credit accounts in stable order.
  await tx.$queryRaw`SELECT id FROM Customer WHERE tenantId=${tenantId} AND id IN (${customerId}, ${referredById}) ORDER BY id FOR UPDATE`;
  const settingKey = 'CUSTOMER_REFERRAL_AWARD:' + customerId;
  const key = { tenantId, settingKey };
  const awarded = await tx.$queryRaw<{ settingKey: string }[]>`SELECT settingKey FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${settingKey} FOR UPDATE`;
  if (awarded.length) return 0;
  const referrer = await tx.customer.findFirst({ where: { tenantId, id: referredById }, select: { id: true } });
  if (!referrer) return 0;
  const current = await tx.ticket.findFirst({ where: { ...paidGrooming, tenantId, customerId, id: ticketId }, select: { id: true } });
  if (!current) return 0;
  const earlier = await tx.ticket.findFirst({ where: { ...paidGrooming, tenantId, customerId, id: { not: ticketId } }, select: { id: true } });
  if (earlier) return 0;
  const amountCents = await referralCreditCents(tenantId, tx);
  if (!amountCents) return 0;
  await tx.tenantSetting.create({ data: { ...key, value: { ticketId, referredById, amountCents } } });
  const entry = { tenantId, ticketId, actorUserId, amountCents, entryType: 'CREDIT' as const, referenceId: settingKey };
  await addAccountEntry({ ...entry, customerId: referredById, reason: 'Referral credit after the new client’s first paid groom.' }, tx);
  await addAccountEntry({ ...entry, customerId, reason: 'New-client referral credit after the first paid groom.' }, tx);
  return amountCents;
}
