import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const products = await db.product.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, priceCents: true, quantity: true } });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const tenantId=tenantFrom(request); if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
  const b=await request.json(); const name=String(b.name||"").trim(),sku=String(b.sku||"").trim()||null,priceCents=Math.max(0,Math.round(Number(b.priceCents)||0)),quantity=Math.max(0,Math.round(Number(b.quantity)||0));
  if(!name)return NextResponse.json({error:"Product name is required."},{status:400});
  if(sku&&await db.product.findFirst({where:{tenantId,sku}}))return NextResponse.json({error:"That SKU is already in use."},{status:409});
  const product=await db.product.create({data:{tenantId,name,sku,priceCents,quantity,active:true},select:{id:true,name:true,sku:true,priceCents:true,quantity:true}});
  return NextResponse.json({product},{status:201});
}

export async function PATCH(request: NextRequest) {
  const tenantId=tenantFrom(request); if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
  const b=await request.json(),id=String(b.id||""); if(!id)return NextResponse.json({error:"Product id is required."},{status:400});
  const existing=await db.product.findFirst({where:{id,tenantId}}); if(!existing)return NextResponse.json({error:"Product not found."},{status:404});
  const data:any={}; if(b.name!==undefined){const name=String(b.name).trim();if(!name)return NextResponse.json({error:"Product name is required."},{status:400});data.name=name} if(b.sku!==undefined)data.sku=String(b.sku||"").trim()||null; if(b.priceCents!==undefined)data.priceCents=Math.max(0,Math.round(Number(b.priceCents)||0)); if(b.quantity!==undefined)data.quantity=Math.max(0,Math.round(Number(b.quantity)||0)); if(b.active!==undefined)data.active=Boolean(b.active);
  const product=await db.product.update({where:{id},data,select:{id:true,name:true,sku:true,priceCents:true,quantity:true}}); return NextResponse.json({product});
}
