import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";

export type AccountEntryType = "OWED" | "CREDIT";

export async function getCustomerAccount(tenantId: string, customerId: string) {
  const rows = await db.$queryRaw<any[]>`
    SELECT c.id, c.firstName, c.lastName, c.balanceCents, c.creditCents, c.loyaltyPoints,
      (SELECT COUNT(*) FROM CustomerPaymentMethod pm WHERE pm.tenantId=${tenantId} AND pm.customerId=c.id AND pm.active=true) AS paymentMethodCount
    FROM Customer c
    WHERE c.id=${customerId} AND c.tenantId=${tenantId}
    LIMIT 1`;
  if (!rows.length) return null;
  const ledger = await db.$queryRaw<any[]>`
    SELECT id, entryType, amountCents, reason, ticketId, actorUserId, createdAt
    FROM CustomerAccountLedger
    WHERE tenantId=${tenantId} AND customerId=${customerId}
    ORDER BY createdAt DESC LIMIT 50`;
  const rewards = await db.$queryRaw<any[]>`
    SELECT id, points, reason, ticketId, rewardId, actorUserId, createdAt
    FROM CustomerRewardLedger
    WHERE tenantId=${tenantId} AND customerId=${customerId}
    ORDER BY createdAt DESC LIMIT 50`;
  const methods = await db.$queryRaw<any[]>`
    SELECT id, provider, brand, last4, expMonth, expYear, isDefault, active, createdAt
    FROM CustomerPaymentMethod
    WHERE tenantId=${tenantId} AND customerId=${customerId} AND active=true
    ORDER BY isDefault DESC, createdAt DESC`;
  return { customer: rows[0], ledger, rewards, paymentMethods: methods };
}

export async function addAccountEntry(params: {
  tenantId: string;
  customerId: string;
  ticketId?: string | null;
  actorUserId?: string | null;
  entryType: AccountEntryType;
  amountCents: number;
  reason: string;
  referenceId?: string | null;
}) {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw new Error("Account amount must be a positive whole number of cents.");
  return db.$transaction(async tx => {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId)
      VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId || null},${params.actorUserId || null},${params.entryType},${params.amountCents},${params.reason},${params.referenceId || null})`;
    const field = params.entryType === "OWED" ? "balanceCents" : "creditCents";
    await tx.$executeRawUnsafe(`UPDATE Customer SET ${field} = ${field} + ? WHERE id = ? AND tenantId = ?`, params.amountCents, params.customerId, params.tenantId);
    return id;
  });
}

export async function settleOwedBalance(params: {
  tenantId: string;
  customerId: string;
  ticketId?: string | null;
  actorUserId?: string | null;
  amountCents: number;
  reason: string;
  referenceId?: string | null;
}) {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw new Error("Settlement amount must be a positive whole number of cents.");
  return db.$transaction(async tx => {
    const customer = await tx.$queryRaw<any[]>`SELECT balanceCents FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;
    if (!customer.length) throw new Error("Customer could not be found.");
    const amount = Math.min(params.amountCents, Number(customer[0].balanceCents || 0));
    if (amount <= 0) return { amountCents: 0, id: null };
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId)
      VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId || null},${params.actorUserId || null},'OWED',${-amount},${params.reason},${params.referenceId || null})`;
    await tx.$executeRaw`UPDATE Customer SET balanceCents = GREATEST(0, balanceCents - ${amount}) WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;
    return { amountCents: amount, id };
  });
}

export async function awardRewards(params: { tenantId:string; customerId:string; ticketId?:string|null; actorUserId?:string|null; points:number; reason:string; referenceId?:string|null }) {
  if (!Number.isInteger(params.points) || params.points <= 0) return null;
  return db.$transaction(async tx => {
    const id=randomUUID();
    await tx.$executeRaw`
      INSERT INTO CustomerRewardLedger (id,tenantId,customerId,ticketId,actorUserId,points,reason,referenceId)
      VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.points},${params.reason},${params.referenceId||null})`;
    await tx.$executeRaw`UPDATE Customer SET loyaltyPoints = loyaltyPoints + ${params.points} WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;
    return id;
  });
}

export async function redeemRewards(params:{tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;points:number;rewardId:string;reason:string}) {
  if (!Number.isInteger(params.points) || params.points <= 0) throw new Error("Reward points must be a positive whole number.");
  return db.$transaction(async tx => {
    const customer=await tx.$queryRaw<any[]>`SELECT loyaltyPoints FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;
    if(!customer.length) throw new Error("Customer could not be found.");
    if(Number(customer[0].loyaltyPoints||0)<params.points) throw new Error("Customer does not have enough Reward Points.");
    const id=randomUUID();
    await tx.$executeRaw`
      INSERT INTO CustomerRewardLedger (id,tenantId,customerId,ticketId,actorUserId,rewardId,points,reason)
      VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.rewardId},${-params.points},${params.reason})`;
    await tx.$executeRaw`UPDATE Customer SET loyaltyPoints = loyaltyPoints - ${params.points} WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;
    return id;
  });
}

export async function getTenantNumberSetting(tenantId:string,key:string,fallback:number) {
  const rows=await db.$queryRaw<any[]>`SELECT value FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${key} LIMIT 1`;
  if(!rows.length) return fallback;
  const raw=rows[0].value;
  const value=typeof raw==="string"?Number(raw):Number(raw);
  return Number.isFinite(value)?value:fallback;
}
