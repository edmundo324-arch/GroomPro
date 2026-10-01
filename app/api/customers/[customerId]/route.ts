import { NextRequest, NextResponse } from "next/server";
import { getCustomerProfile } from "@/src/lib/customer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const tenantId = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
  const { customerId } = await params;

  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const customer = await getCustomerProfile(tenantId, customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  return NextResponse.json({ customer });
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{customerId:string}>}){
 const tenantId=request.headers.get("x-tenant-id")||request.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID;
 if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 const {db}=await import("@/src/lib/db");const {getActiveEmployeeSession}=await import("@/src/lib/employee-session");
 const sid=request.cookies.get("groompro_session")?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 const {customerId}=await params;
 try{const b=await request.json();const firstName=String(b.firstName||"").trim(),lastName=String(b.lastName||"").trim(),email=String(b.email||"").trim();
 if(!firstName||!lastName||firstName.length>191||lastName.length>191||email.length>191)return NextResponse.json({error:"Valid first and last names are required (up to 191 characters)."},{status:400});
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
 const result=await db.customer.updateMany({where:{id:customerId,tenantId},data:{firstName,lastName,email:email||null,notes:String(b.notes||"").trim()||null}});
 if(!result.count)return NextResponse.json({error:"Customer not found."},{status:404});
 return NextResponse.json({customer:await getCustomerProfile(tenantId,customerId)});
 }catch{return NextResponse.json({error:"Could not save customer. Please retry."},{status:400})}
}
