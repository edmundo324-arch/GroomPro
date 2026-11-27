import {recordStockCount} from '@/src/lib/stock-history';
import {offlineCreateId} from '@/src/lib/offline-transaction';
import {catalogVersion} from '@/src/lib/catalog-version';
import {catalogSyncScope,emptyCatalogSync} from '@/src/lib/catalog-sync';
import {catalogRecord,retainLegacyServiceSnapshots,syncCatalogAppointments} from '@/src/lib/catalog-sync-store';
import {vipSyncChoices,syncVipPlanMembers} from '@/src/lib/vip-plan-sync';
import {serviceIsCurrentOffer,serviceIsPromoting,servicePromotionFields} from '@/src/lib/service-promotion';
import {withRequestPolicy,catalogFeature} from '@/src/lib/request-policy';
import {loadBreeds} from '@/src/lib/breed-store';
import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {db} from "@/src/lib/db";
import {getActiveEmployeeSession} from "@/src/lib/employee-session";
import {catalogInput} from "@/src/lib/catalog-input";
const tenant=(r:NextRequest)=>r.headers.get("x-tenant-id")||r.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||"";
const prefix="VIP_PLAN:";
async function handlePolicyGET(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 try{const offerHistory=r.nextUrl.searchParams.get('offerHistory')==='1';
 const[services,products,packages,plans,usedOffers]=await Promise.all([
 db.service.findMany({where:{tenantId},orderBy:{name:"asc"}}),db.product.findMany({where:{tenantId},orderBy:{name:"asc"}}),
 db.package.findMany({where:{tenantId},include:{items:{orderBy:{sortOrder:"asc"}}},orderBy:{name:"asc"}}),
 db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:prefix}}}),
 offerHistory?db.$queryRaw<{serviceId:string}[]>`SELECT DISTINCT l.serviceId FROM TicketLine l JOIN Service s ON s.id=l.serviceId JOIN Ticket t ON t.id=l.ticketId WHERE s.tenantId=${tenantId} AND t.tenantId=${tenantId} AND l.sourceKey=CONCAT('offer-today:',l.serviceId)`:Promise.resolve([])]);
 const usedOfferIds=new Set(usedOffers.map(line=>line.serviceId));
 return NextResponse.json({breeds:await loadBreeds(db,tenantId),services:services.map(service=>({...service,_catalogVersion:catalogVersion(service),...(offerHistory?{previousOfferRecorded:usedOfferIds.has(service.id)}:{})})),products,packages:packages.map(p=>({...p,priceCents:p.basePriceCents,_offlineVersion:catalogVersion(p),_catalogVersion:catalogVersion(p)})),plans:plans.map(p=>({...p.value as object,id:p.settingKey.slice(prefix.length),_catalogVersion:catalogVersion(p.value)}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Catalog load",error);return NextResponse.json({error:"Unable to load the catalog. Please retry."},{status:503})}
}
async function save(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 const sid=r.cookies.get("groompro_session")?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:"An administrator or manager must sign in to edit the catalog."},{status:403});
 try{
 const body=await r.json(),data=catalogInput(body),id=r.method==="PATCH"?String(body.id||""):(offlineCreateId()||randomUUID());
 const applyTo=catalogSyncScope(body.applyTo);
 const vip=vipSyncChoices(body),updateMembers=vip.updateVipBenefits||vip.updateVipPrice;
 if(updateMembers&&(r.method!=='PATCH'||data.kind!=='plans'))throw Error('Choose an existing VIP plan before updating current members.');
 if(applyTo!=='NONE'&&(r.method!=='PATCH'||!['services','packages'].includes(data.kind)))throw Error('Choose an existing service or package before updating appointments.');
 if(data.groomingRules){const breeds=await loadBreeds(db,tenantId);if([...(data.groomingRules.breedIds||[]),...(data.groomingRules.excludedBreedIds||[])].some(id=>!breeds.some(b=>b.id===id)))throw Error('Choose breeds from this business’s dictionary.');}
 if(!id)return NextResponse.json({error:"Select an item to edit."},{status:400});
 const common={name:data.name,description:data.description,active:data.active};
 const result=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const before=r.method==='PATCH'?await catalogRecord(tx,tenantId,data.kind,id):null;
 if((applyTo!=='NONE'||updateMembers)&&(!before||!body.catalogVersion||body.catalogVersion!==catalogVersion(before)))throw Error('This catalog item changed while you were editing. Your edits are still here; reopen the item to review the latest version before applying updates.');
 if(before&&data.kind==='services')await retainLegacyServiceSnapshots(tx,tenantId,before,data);
 const writeItem=async()=>{
 if(data.kind==="services"){
 const previous=await tx.service.findFirst({where:{id,tenantId}});
 const categoryConfig=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'SERVICE_CATEGORIES'}}});
 if(data.category!==previous?.category&&(categoryConfig?.value as any[]||[]).some(c=>c.name===data.category&&c.active===false))throw Error('Choose an active service category.');
 if(r.method==="PATCH"&&!await tx.service.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 if(data.code&&await tx.service.findFirst({where:{tenantId,code:data.code,id:{not:id}}}))throw Error("Service ID is already used.");
 const recordOffer=serviceIsCurrentOffer(previous)||data.active&&(data.promotingServices??serviceIsPromoting(previous));
 const values={...common,...(recordOffer||data.promotingServices!==undefined||data.offerTodayLabel!==undefined?{customFields:servicePromotionFields(previous?.customFields,data.promotingServices,data.offerTodayLabel,recordOffer)}:{}),...(data.workflowRole!==undefined?{workflowRole:data.workflowRole as any}:{}),...(data.favorite!==undefined?{favorite:data.favorite}:{}),priceCents:data.priceCents,category:data.category,durationMin:data.durationMin,...(data.code!==undefined?{code:data.code}:{}),...(data.commissionExemptRoles!==undefined?{commissionExemptRoles:data.commissionExemptRoles}:{})};
 return r.method==="PATCH"?tx.service.update({where:{id},data:values}):tx.service.create({data:{id,tenantId,...values}});
 }
 if(data.kind==="packages"||data.kind==="plans"){
 const defaults=await tx.service.findMany({where:{tenantId,id:{in:data.items.map(i=>i.serviceId)}},select:{id:true,workflowRole:true}});
 for(const item of data.items)if(!body.items?.find((i:any)=>i.serviceId===item.serviceId)?.role)item.role=defaults.find(s=>s.id===item.serviceId)?.workflowRole||"ADD_ON";
 }
 if(data.kind==="products"){
 await tx.$queryRaw`SELECT id FROM Product WHERE id=${id} AND tenantId=${tenantId} FOR UPDATE`;
 const previous=await tx.product.findFirst({where:{id,tenantId}});
 if(r.method==="PATCH"&&!await tx.product.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 if(data.sku&&await tx.product.findFirst({where:{tenantId,sku:data.sku,id:{not:id}}}))throw new Error("That SKU is already in use.");
 const values={...common,priceCents:data.priceCents,sku:data.sku,quantity:data.quantity,costCents:data.costCents};
 const saved=r.method==="PATCH"?await tx.product.update({where:{id},data:values}):await tx.product.create({data:{id,tenantId,...values}});
 await recordStockCount(tx,tenantId,saved,previous?.quantity??null,session.user.id);return saved;
 }
 if(data.kind==="packages"){
 if(r.method==="PATCH"&&!await tx.package.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 const ids=data.items.map(i=>i.serviceId);if((await tx.service.count({where:{tenantId,id:{in:ids}}}))!==ids.length)throw new Error("Every package service must belong to this business.");
 const values={...common,...(data.groomingRules!==undefined?{groomingRules:data.groomingRules||{}}:{}),...(data.minimumWeightLbs!==undefined?{minimumWeightLbs:data.minimumWeightLbs}:{}),...(data.maximumWeightLbs!==undefined?{maximumWeightLbs:data.maximumWeightLbs}:{}),basePriceCents:data.priceCents,...(data.defaultForBreeds!==undefined?{defaultForBreeds:data.defaultForBreeds}:{})};
 const saved=r.method==="PATCH"?await tx.package.update({where:{id},data:values}):await tx.package.create({data:{id,tenantId,...values}});
 await tx.packageItem.deleteMany({where:{packageId:id,tenantId}});
 if(data.items.length)await tx.packageItem.createMany({data:data.items.map((item,sortOrder)=>({...item,tenantId,packageId:id,sortOrder,role:item.role as any}))});return saved;
 }
 const settingKey=prefix+id;
 if(r.method==="PATCH"&&!await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}}))throw new Error("Item not found.");
 const ids=data.items.map(i=>i.serviceId);if((await tx.service.count({where:{tenantId,id:{in:ids}}}))!==ids.length)throw new Error("Every VIP service must belong to this business.");
 const prior=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}});
 const value={...(prior?.value as any||{}),...common,...(data.minimumWeightLbs!==undefined?{minimumWeightLbs:data.minimumWeightLbs}:{}),...(data.maximumWeightLbs!==undefined?{maximumWeightLbs:data.maximumWeightLbs}:{}),...(data.groomingRules!==undefined?{groomingRules:data.groomingRules}:{}),priceCents:data.priceCents,items:data.items,billingDay:data.billingDay,billingDaySecond:data.billingDaySecond};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});return{id,...value};
 };
 const item=await writeItem();
 const after=applyTo!=='NONE'||updateMembers?await catalogRecord(tx,tenantId,data.kind,id):null;
 const sync=applyTo!=='NONE'?await syncCatalogAppointments(tx,tenantId,session.user.id,{kind:data.kind as 'services'|'packages',before,after},applyTo):emptyCatalogSync();
 if(updateMembers)Object.assign(sync,await syncVipPlanMembers(tx,tenantId,session.user.id,id,before,after,vip));
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'CATALOG_'+(r.method==='POST'?'CREATE':'EDIT'),summary:`Updated ${data.kind}: ${data.name}.`,details:{kind:data.kind,itemId:id,applyTo,...vip,updatedAppointments:sync.updated,unchangedAppointments:sync.unchanged,review:sync.review}}});
 return {item,sync};
 },{timeout:120000,isolationLevel:'ReadCommitted'});return NextResponse.json(result,{status:r.method==="POST"?201:200});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save catalog item."},{status:400})}
}
const handlePolicyPOST=save;const handlePolicyPATCH=save;


export const GET=withRequestPolicy(handlePolicyGET, {feature:catalogFeature});
export const POST=withRequestPolicy(handlePolicyPOST, {feature:catalogFeature});
export const PATCH=withRequestPolicy(handlePolicyPATCH, {feature:catalogFeature});
