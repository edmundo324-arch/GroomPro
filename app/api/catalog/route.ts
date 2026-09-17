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
 return NextResponse.json({services,products,packages:packages.map(p=>({...p,priceCents:p.basePriceCents})),plans:plans.map(p=>({...p.value as object,id:p.settingKey.slice(prefix.length)}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Catalog load",error);return NextResponse.json({error:"Unable to load the catalog. Please retry."},{status:503})}
}
async function save(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 const sid=r.cookies.get("groompro_session")?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 if(!["ADMIN","MANAGER"].includes(session.user.role))return NextResponse.json({error:"An administrator or manager must sign in to edit the catalog."},{status:403});
 try{
 const body=await r.json(),data=catalogInput(body),id=r.method==="PATCH"?String(body.id||""):randomUUID();
 if(!id)return NextResponse.json({error:"Select an item to edit."},{status:400});
 const common={name:data.name,description:data.description,active:data.active};
 const item=await db.$transaction(async tx=>{
 if(data.kind==="services"){
 if(r.method==="PATCH"&&!await tx.service.findFirst({where:{id,tenantId}}))throw new Error("Item not found.");
 const values={...common,priceCents:data.priceCents,category:data.category,durationMin:data.durationMin,commissionPct:data.commissionPct};
 return r.method==="PATCH"?tx.service.update({where:{id},data:values}):tx.service.create({data:{id,tenantId,...values}});
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
 const values={...common,basePriceCents:data.priceCents};
 const saved=r.method==="PATCH"?await tx.package.update({where:{id},data:values}):await tx.package.create({data:{id,tenantId,...values}});
 await tx.packageItem.deleteMany({where:{packageId:id,tenantId}});
 if(data.items.length)await tx.packageItem.createMany({data:data.items.map((item,sortOrder)=>({...item,tenantId,packageId:id,sortOrder}))});return saved;
 }
 const settingKey=prefix+id;
 if(r.method==="PATCH"&&!await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}}))throw new Error("Item not found.");
 const value={...common,priceCents:data.priceCents};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});return{id,...value};
 });return NextResponse.json({item},{status:r.method==="POST"?201:200});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save catalog item."},{status:400})}
}
export const POST=save;export const PATCH=save;

