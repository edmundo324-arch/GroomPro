import {loadBreeds} from '@/src/lib/breed-store';
import {writeAudit} from '@/src/lib/audit';
import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {db} from "@/src/lib/db";
import {getActiveEmployeeSession} from "@/src/lib/employee-session";
import {catalogInput} from "@/src/lib/catalog-input";
const tenant=(r:NextRequest)=>r.headers.get("x-tenant-id")||r.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||"";
const prefix="VIP_PLAN:";
export async function GET(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 try{const[services,products,packages,plans]=await Promise.all([
 db.service.findMany({where:{tenantId},orderBy:{name:"asc"}}),db.product.findMany({where:{tenantId},orderBy:{name:"asc"}}),
 db.package.findMany({where:{tenantId},include:{items:{orderBy:{sortOrder:"asc"}}},orderBy:{name:"asc"}}),
 db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:prefix}}})]);
 return NextResponse.json({breeds:await loadBreeds(db,tenantId),services,products,packages:packages.map(p=>({...p,priceCents:p.basePriceCents})),plans:plans.map(p=>({...p.value as object,id:p.settingKey.slice(prefix.length)}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Catalog load",error);return NextResponse.json({error:"Unable to load the catalog. Please retry."},{status:503})}
}
async function save(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 const sid=r.cookies.get("groompro_session")?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 if(!["ADMIN","MANAGER"].includes(session.user.role))return NextResponse.json({error:"An administrator or manager must sign in to edit the catalog."},{status:403});
 try{
 const body=await r.json(),data=catalogInput(body),id=r.method==="PATCH"?String(body.id||""):randomUUID();
 if(data.groomingRules){const breeds=await loadBreeds(db,tenantId);if([...(data.groomingRules.breedIds||[]),...(data.groomingRules.excludedBreedIds||[])].some(id=>!breeds.some(b=>b.id===id)))throw Error('Choose breeds from this business’s dictionary.');}
 if(!id)return NextResponse.json({error:"Select an item to edit."},{status:400});
 const common={name:data.name,description:data.description,active:data.active};
 const item=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 if(data.kind==="services"){
 const previous=await tx.service.findFirst({where:{id,tenantId}});
 const categoryConfig=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'SERVICE_CATEGORIES'}}});
 if(data.category!==previous?.category&&(categoryConfig?.value as any[]||[]).some(c=>c.name===data.category&&c.active===false))throw Error('Choose an active service category.');
 if(r.method==="PATCH"&&!await tx.service.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 if(data.code&&await tx.service.findFirst({where:{tenantId,code:data.code,id:{not:id}}}))throw Error("Service ID is already used.");
 const values={...common,...(data.workflowRole!==undefined?{workflowRole:data.workflowRole as any}:{}),...(data.favorite!==undefined?{favorite:data.favorite}:{}),priceCents:data.priceCents,category:data.category,durationMin:data.durationMin,...(data.code!==undefined?{code:data.code}:{}),...(data.commissionExemptRoles!==undefined?{commissionExemptRoles:data.commissionExemptRoles}:{})};
 return r.method==="PATCH"?tx.service.update({where:{id},data:values}):tx.service.create({data:{id,tenantId,...values}});
 }
 if(data.kind==="packages"||data.kind==="plans"){
 const defaults=await tx.service.findMany({where:{tenantId,id:{in:data.items.map(i=>i.serviceId)}},select:{id:true,workflowRole:true}});
 for(const item of data.items)if(!body.items?.find((i:any)=>i.serviceId===item.serviceId)?.role)item.role=defaults.find(s=>s.id===item.serviceId)?.workflowRole||"ADD_ON";
 }
 if(data.kind==="products"){
 if(r.method==="PATCH"&&!await tx.product.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 if(data.sku&&await tx.product.findFirst({where:{tenantId,sku:data.sku,id:{not:id}}}))throw new Error("That SKU is already in use.");
 const values={...common,priceCents:data.priceCents,sku:data.sku,quantity:data.quantity,costCents:data.costCents};
 return r.method==="PATCH"?tx.product.update({where:{id},data:values}):tx.product.create({data:{id,tenantId,...values}});
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
 });await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TENANT",entityId:tenantId,action:"CATALOG_"+(r.method==="POST"?"CREATE":"EDIT"),summary:`Updated ${data.kind}: ${data.name}.`,details:{kind:data.kind,itemId:id}});return NextResponse.json({item},{status:r.method==="POST"?201:200});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save catalog item."},{status:400})}
}
export const POST=save;export const PATCH=save;

