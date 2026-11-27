import {catalogSyncScope} from '@/src/lib/catalog-sync';
import {catalogRecord,syncCatalogAppointments} from '@/src/lib/catalog-sync-store';
import {withRequestPolicy} from '@/src/lib/request-policy';
import { NextRequest,NextResponse } from "next/server";import { Prisma } from "@prisma/client";import { db } from "@/src/lib/db";import { getActiveEmployeeSession } from "@/src/lib/employee-session";
const COOKIE="groompro_session";const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";async function actor(r:NextRequest){const t=tenantFrom(r),sid=r.cookies.get(COOKIE)?.value||"";return t&&sid?getActiveEmployeeSession(t,sid):null}function parseMode(b:Record<string,unknown>){return b.mode==="FIXED"?"FIXED":b.mode==="PERCENT_ADJUSTMENT"?"PERCENT_ADJUSTMENT":"FOLLOW_BASE"}
async function handlePolicyPUT(r:NextRequest){
 const tenantId=tenantFrom(r),session=await actor(r);
 if(!tenantId||!session)return NextResponse.json({error:"Employee PIN is required for pricing changes."},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session.user.role)&&session.user.role!=="MANAGER")return NextResponse.json({error:"Manager access required."},{status:403});
 try{
  const b=await r.json() as Record<string,unknown>,locationId=String(b.locationId||""),entityId=String(b.entityId||""),entityType=b.entityType==="PACKAGE"?"PACKAGE":"SERVICE",mode=parseMode(b),adjustmentPct=Number(b.adjustmentPct??0),priceOverrideCents=b.priceOverrideCents==null?null:Number(b.priceOverrideCents),scope=catalogSyncScope(b.applyTo);
  if(!locationId||!entityId)return NextResponse.json({error:"locationId and entityId are required."},{status:400});
  if(!Number.isFinite(adjustmentPct)||adjustmentPct<=-100)return NextResponse.json({error:"A valid adjustment percentage greater than -100 is required."},{status:400});
  if(mode==="FIXED"&&(priceOverrideCents===null||!Number.isInteger(priceOverrideCents)||priceOverrideCents<0))return NextResponse.json({error:"Enter a fixed price of $0.00 or more."},{status:400});
  const kind=entityType==='PACKAGE'?'packages':'services',pricing=entityType==="PACKAGE"?"LocationPackagePricing":"LocationServicePricing",foreignKey=entityType==="PACKAGE"?"packageId":"serviceId";
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const validLocation=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM Location WHERE id=${locationId} AND tenantId=${tenantId} LIMIT 1`);
   if(!validLocation.length)return {error:'Location not found.',status:404};
   const record=await catalogRecord(tx,tenantId,kind,entityId);
   if(!record?.active)return {error:`${entityType==='PACKAGE'?'Package':'Service'} not found.`,status:404};
   const beforeLocationPricing=await tx.$queryRaw<Array<{locationId:string;priceAdjustmentPct:Prisma.Decimal|number|null;priceOverrideCents:number|null;active:boolean}>>(Prisma.sql`SELECT locationId,priceAdjustmentPct,priceOverrideCents,active FROM ${Prisma.raw(pricing)} WHERE tenantId=${tenantId} AND locationId=${locationId} AND ${Prisma.raw(foreignKey)}=${entityId} AND active=true`);
   const locationPricing=[{locationId,priceAdjustmentPct:mode==='PERCENT_ADJUSTMENT'?adjustmentPct:0,priceOverrideCents:mode==='FIXED'?priceOverrideCents:null,active:true}];
   await tx.$executeRaw(Prisma.sql`INSERT INTO ${Prisma.raw(pricing)} (id,tenantId,locationId,${Prisma.raw(foreignKey)},priceAdjustmentPct,priceOverrideCents,active) VALUES (${crypto.randomUUID()},${tenantId},${locationId},${entityId},${locationPricing[0].priceAdjustmentPct},${locationPricing[0].priceOverrideCents},true) ON DUPLICATE KEY UPDATE priceAdjustmentPct=VALUES(priceAdjustmentPct),priceOverrideCents=VALUES(priceOverrideCents),active=true`);
   const sync=await syncCatalogAppointments(tx,tenantId,session.user.id,{kind,before:record,after:record,locationId,beforeLocationPricing,locationPricing},scope);
   return {ok:true,entityType,entityId,locationId,mode,actorUserId:session.user.id,sync};
  },{timeout:120000,isolationLevel:'ReadCommitted'});
  return 'error' in result?NextResponse.json({error:result.error},{status:result.status}):NextResponse.json(result);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to save location pricing."},{status:400})}
}

export const PUT=withRequestPolicy(handlePolicyPUT, {configure:true});
