import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";

export type AccountEntryType = "OWED" | "CREDIT";

export async function getCustomerAccount(tenantId: string, customerId: string) {
  const rows = await db.$queryRaw<any[]>`
    SELECT c.id, c.firstName, c.lastName, c.balanceCents, c.creditCents, c.loyaltyPoints,
      (SELECT COUNT(*) FROM CustomerPaymentMethod pm WHERE pm.tenantId=${tenantId} AND pm.customerId=c.id AND pm.active=true) AS paymentMethodCount
    FROM Customer c WHERE c.id=${customerId} AND c.tenantId=${tenantId} LIMIT 1`;
  if (!rows.length) return null;
  const ledger = await db.$queryRaw<any[]>`SELECT id, entryType, amountCents, reason, ticketId, actorUserId, createdAt FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND customerId=${customerId} ORDER BY createdAt DESC LIMIT 50`;
  const rewards = await db.$queryRaw<any[]>`SELECT id, points, reason, ticketId, rewardId, actorUserId, createdAt FROM CustomerRewardLedger WHERE tenantId=${tenantId} AND customerId=${customerId} ORDER BY createdAt DESC LIMIT 50`;
  const methods = await db.$queryRaw<any[]>`SELECT id, provider, brand, last4, expMonth, expYear, isDefault, active, createdAt FROM CustomerPaymentMethod WHERE tenantId=${tenantId} AND customerId=${customerId} AND active=true ORDER BY isDefault DESC, createdAt DESC`;
  return { customer: rows[0], ledger, rewards, paymentMethods: methods };
}

export async function addAccountEntry(params: {tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;entryType:AccountEntryType;amountCents:number;reason:string;referenceId?:string|null}) {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw new Error("Account amount must be a positive whole number of cents.");
  return db.$transaction(async tx => {
    const id=randomUUID();
    await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.entryType},${params.amountCents},${params.reason},${params.referenceId||null})`;
    const field=params.entryType==="OWED"?"balanceCents":"creditCents";
    await tx.$executeRawUnsafe(`UPDATE Customer SET ${field} = ${field} + ? WHERE id = ? AND tenantId = ?`,params.amountCents,params.customerId,params.tenantId);
    return id;
  });
}

export async function adjustAccountEntry(params:{tenantId:string;customerId:string;actorUserId?:string|null;entryType:AccountEntryType;amountCents:number;reason:string;ticketId?:string|null}) {
  if(!Number.isInteger(params.amountCents)||params.amountCents===0) throw new Error("Adjustment must be a non-zero whole number of cents.");
  return db.$transaction(async tx=>{
    const field=params.entryType==="OWED"?"balanceCents":"creditCents";
    const rows=await tx.$queryRaw<any[]>`SELECT ${field} AS currentAmount FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;
    if(!rows.length) throw new Error("Customer could not be found.");
    const current=Number(rows[0].currentAmount||0); const next=current+params.amountCents;
    if(next<0) throw new Error(params.entryType==="OWED"?"The owed balance cannot become negative.":"Customer credit cannot become negative.");
    const id=randomUUID();
    await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason) VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.entryType},${params.amountCents},${params.reason})`;
    await tx.$executeRawUnsafe(`UPDATE Customer SET ${field} = ? WHERE id = ? AND tenantId = ?`,next,params.customerId,params.tenantId);
    return {id,currentCents:current,newCents:next};
  });
}

export async function settleOwedBalance(params:{tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;amountCents:number;reason:string;referenceId?:string|null}) {
  if(!Number.isInteger(params.amountCents)||params.amountCents<=0) throw new Error("Settlement amount must be a positive whole number of cents.");
  return db.$transaction(async tx=>{
    const customer=await tx.$queryRaw<any[]>`SELECT balanceCents FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;
    if(!customer.length) throw new Error("Customer could not be found.");
    const amount=Math.min(params.amountCents,Number(customer[0].balanceCents||0)); if(amount<=0)return{amountCents:0,id:null};
    const id=randomUUID();
    await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},'OWED',${-amount},${params.reason},${params.referenceId||null})`;
    await tx.$executeRaw`UPDATE Customer SET balanceCents=GREATEST(0,balanceCents-${amount}) WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;
    return{amountCents:amount,id};
  });
}

export async function settleCustomerCredit(params:{tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;amountCents:number;reason:string}) {
  if(!Number.isInteger(params.amountCents)||params.amountCents<=0) throw new Error("Credit application must be a positive whole number of cents.");
  return adjustAccountEntry({tenantId:params.tenantId,customerId:params.customerId,actorUserId:params.actorUserId,entryType:"CREDIT",amountCents:-params.amountCents,reason:params.reason,ticketId:params.ticketId});
}

export async function awardRewards(params:{tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;points:number;reason:string;referenceId?:string|null}) {
  if(!Number.isInteger(params.points)||params.points<=0)return null;
  return db.$transaction(async tx=>{const id=randomUUID();await tx.$executeRaw`INSERT INTO CustomerRewardLedger (id,tenantId,customerId,ticketId,actorUserId,points,reason,referenceId) VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.points},${params.reason},${params.referenceId||null})`;await tx.$executeRaw`UPDATE Customer SET loyaltyPoints=loyaltyPoints+${params.points} WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;return id;});
}

export async function adjustRewardPoints(params:{tenantId:string;customerId:string;actorUserId?:string|null;points:number;reason:string}) {
  if(!Number.isInteger(params.points)||params.points===0)throw new Error("Reward adjustment must be a non-zero whole number.");
  return db.$transaction(async tx=>{const rows=await tx.$queryRaw<any[]>`SELECT loyaltyPoints FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;if(!rows.length)throw new Error("Customer could not be found.");const next=Number(rows[0].loyaltyPoints||0)+params.points;if(next<0)throw new Error("Reward Points cannot become negative.");const id=randomUUID();await tx.$executeRaw`INSERT INTO CustomerRewardLedger (id,tenantId,customerId,actorUserId,points,reason) VALUES (${id},${params.tenantId},${params.customerId},${params.actorUserId||null},${params.points},${params.reason})`;await tx.$executeRaw`UPDATE Customer SET loyaltyPoints=${next} WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;return{id,newPoints:next};});
}

export async function redeemRewards(params:{tenantId:string;customerId:string;ticketId?:string|null;actorUserId?:string|null;points:number;rewardId:string;reason:string}) {
  if(!Number.isInteger(params.points)||params.points<=0)throw new Error("Reward points must be a positive whole number.");
  return db.$transaction(async tx=>{const customer=await tx.$queryRaw<any[]>`SELECT loyaltyPoints FROM Customer WHERE id=${params.customerId} AND tenantId=${params.tenantId} FOR UPDATE`;if(!customer.length)throw new Error("Customer could not be found.");if(Number(customer[0].loyaltyPoints||0)<params.points)throw new Error("Customer does not have enough Reward Points.");const id=randomUUID();await tx.$executeRaw`INSERT INTO CustomerRewardLedger (id,tenantId,customerId,ticketId,actorUserId,rewardId,points,reason) VALUES (${id},${params.tenantId},${params.customerId},${params.ticketId||null},${params.actorUserId||null},${params.rewardId},${-params.points},${params.reason})`;await tx.$executeRaw`UPDATE Customer SET loyaltyPoints=loyaltyPoints-${params.points} WHERE id=${params.customerId} AND tenantId=${params.tenantId}`;return id;});
}

export async function getTenantNumberSetting(tenantId:string,key:string,fallback:number){const rows=await db.$queryRaw<any[]>`SELECT value FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${key} LIMIT 1`;if(!rows.length)return fallback;const value=Number(rows[0].value);return Number.isFinite(value)?value:fallback;}
