import {catalogSyncScope,emptyCatalogSync,type CatalogSyncSummary} from './catalog-sync';
import {catalogRecord,syncCatalogAppointments} from './catalog-sync-store';
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";
export type LocationPriceMode="FOLLOW_BASE"|"PERCENT_ADJUSTMENT"|"FIXED";
export interface LocationPriceRule{mode:LocationPriceMode;adjustmentPct?:number|null;priceCents?:number|null}
export function roundCents(value:number){return Math.round(value)}
export function applyPercent(priceCents:number,percent:number){return roundCents(priceCents*(1+percent/100))}
export function resolveLocationPrice(basePriceCents:number,rule?:LocationPriceRule|null){if(!rule||rule.mode==="FOLLOW_BASE")return basePriceCents;if(rule.mode==="PERCENT_ADJUSTMENT")return applyPercent(basePriceCents,Number(rule.adjustmentPct??0));return Number(rule.priceCents??basePriceCents)}
export function bulkIncreasePrices(pricesCents:number[],percent:number){return pricesCents.map(price=>applyPercent(price,percent))}
export interface PackagePriceChange{id:string;oldPriceCents:number;newPriceCents:number}
export function buildBulkPriceChangeSet(prices:Array<{id:string;priceCents:number}>,percent:number,excludedIds:string[]=[]){const excluded=new Set(excludedIds);return prices.filter(item=>!excluded.has(item.id)).map(item=>({id:item.id,oldPriceCents:item.priceCents,newPriceCents:applyPercent(item.priceCents,percent)}))}
export type PriceResult={basePriceCents:number;adjustmentPct:number;overrideCents:number|null;finalPriceCents:number};
export async function getServicePrice(tenantId:string,locationId:string,serviceId:string):Promise<PriceResult|null>{const rows=await db.$queryRaw<Array<{basePriceCents:number;priceAdjustmentPct:Prisma.Decimal|number|null;priceOverrideCents:number|null}>>(Prisma.sql`SELECT s.priceCents AS basePriceCents,COALESCE(lsp.priceAdjustmentPct,0) AS priceAdjustmentPct,lsp.priceOverrideCents FROM Service s LEFT JOIN LocationServicePricing lsp ON lsp.serviceId=s.id AND lsp.locationId=${locationId} AND lsp.tenantId=${tenantId} AND lsp.active=true WHERE s.id=${serviceId} AND s.tenantId=${tenantId} AND s.active=true LIMIT 1`);if(!rows.length)return null;const row=rows[0],adjustmentPct=Number(row.priceAdjustmentPct??0);return{basePriceCents:row.basePriceCents,adjustmentPct,overrideCents:row.priceOverrideCents,finalPriceCents:row.priceOverrideCents!=null?row.priceOverrideCents:applyPercent(row.basePriceCents,adjustmentPct)}}
export async function getPackagePrice(tenantId:string,locationId:string,packageId:string):Promise<PriceResult|null>{const rows=await db.$queryRaw<Array<{basePriceCents:number;priceAdjustmentPct:Prisma.Decimal|number|null;priceOverrideCents:number|null}>>(Prisma.sql`SELECT p.basePriceCents,COALESCE(lpp.priceAdjustmentPct,0) AS priceAdjustmentPct,lpp.priceOverrideCents FROM Package p LEFT JOIN LocationPackagePricing lpp ON lpp.packageId=p.id AND lpp.locationId=${locationId} AND lpp.tenantId=${tenantId} AND lpp.active=true WHERE p.id=${packageId} AND p.tenantId=${tenantId} AND p.active=true LIMIT 1`);if(!rows.length)return null;const row=rows[0],adjustmentPct=Number(row.priceAdjustmentPct??0);return{basePriceCents:row.basePriceCents,adjustmentPct,overrideCents:row.priceOverrideCents,finalPriceCents:row.priceOverrideCents!=null?row.priceOverrideCents:applyPercent(row.basePriceCents,adjustmentPct)}}
export type BulkPriceChange={entityType:"SERVICE"|"PACKAGE";adjustmentPct:number;entityIds?:string[];reason?:string;actorUserId?:string;applyTo?:unknown};
export async function bulkIncreaseBasePrices(tenantId:string,change:BulkPriceChange){
 if(!Number.isFinite(change.adjustmentPct)||change.adjustmentPct<=-100)throw new Error("A valid percentage greater than -100 is required.");
 const scope=catalogSyncScope(change.applyTo);
 if(scope!=='NONE'&&!change.actorUserId)throw Error('Sign in before applying changes to appointments.');
 const isService=change.entityType==="SERVICE",kind=isService?'services':'packages',table=isService?"Service":"Package",priceColumn=isService?"priceCents":"basePriceCents";
 const idFilter=change.entityIds?.length?Prisma.sql`AND id IN (${Prisma.join(change.entityIds)})`:Prisma.empty;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const rows=await tx.$queryRaw<Array<{id:string;priceCents:number}>>(Prisma.sql`SELECT id,${Prisma.raw(priceColumn)} AS priceCents FROM ${Prisma.raw(table)} WHERE tenantId=${tenantId} AND active=true ${idFilter}`);
  const batchId=randomUUID(),sync=emptyCatalogSync(),candidates=new Set<string>(),updated=new Set<string>(),review=new Map<string,CatalogSyncSummary['review'][number]>();
  await tx.$executeRaw(Prisma.sql`INSERT INTO PricingChangeBatch (id,tenantId,actorUserId,changeType,adjustmentPct,reason) VALUES (${batchId},${tenantId},${change.actorUserId??null},'BASE_PRICE_BULK_ADJUSTMENT',${change.adjustmentPct},${change.reason??null})`);
  for(const row of rows){
   const newPrice=applyPercent(row.priceCents,change.adjustmentPct);
   if(!Number.isSafeInteger(newPrice)||newPrice<0||newPrice>2147483647)throw Error('The updated price is too large. Choose a smaller percentage.');
   const before=scope==='NONE'?null:await catalogRecord(tx,tenantId,kind,row.id);
   if(scope!=='NONE'){
    if(!before)throw Error('A catalog item changed. Refresh Pricing and try again.');
    const matching=await tx.ticket.findMany({where:{tenantId,status:{notIn:['CLOSED','CANCELLED','NO_SHOW']},closedAt:null,lines:{some:isService?{serviceId:row.id}:{OR:[{packageId:row.id},{packageId:null,OR:[{packageName:before.name},{description:{startsWith:before.name+' · '}}]}]}}},select:{id:true}});
    matching.forEach(ticket=>candidates.add(ticket.id));
   }
   await tx.$executeRaw(Prisma.sql`UPDATE ${Prisma.raw(table)} SET ${Prisma.raw(priceColumn)}=${newPrice} WHERE id=${row.id} AND tenantId=${tenantId}`);
   await tx.$executeRaw(Prisma.sql`INSERT INTO PricingChangeItem (id,batchId,entityType,entityId,oldBasePriceCents,newBasePriceCents) VALUES (${randomUUID()},${batchId},${change.entityType},${row.id},${row.priceCents},${newPrice})`);
   if(before){
    const result=await syncCatalogAppointments(tx,tenantId,change.actorUserId!,{kind,before,after:{...before,[priceColumn]:newPrice}},scope);
    result.ticketIds.forEach(id=>updated.add(id));
    for(const entry of result.review){const prior=review.get(entry.ticketId);review.set(entry.ticketId,prior?{...entry,reason:[...new Set([prior.reason,entry.reason])].join(' ')}:entry);}
   }
  }
  sync.ticketIds=[...updated];sync.updated=updated.size;sync.unchanged=[...candidates].filter(id=>!updated.has(id)).length;sync.review=[...review.values()];
  return {batchId,changedCount:rows.length,sync};
 },{timeout:120000,isolationLevel:'ReadCommitted'});
}
