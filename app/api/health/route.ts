import { databaseFailure } from '@/src/lib/database-failure';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import schema from "@/godaddy-groompro-schema.json";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const started = Date.now();
  const headers = { "Cache-Control": "no-store" };
  try {
    const columns = await db.$queryRaw<Array<{tableName:string; columnName:string; folded:number}>>`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, @@lower_case_table_names AS folded FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()`;
    const columnKey = (table:string, column:string) => (Number(columns[0]?.folded) ? table.toLowerCase() : table) + "." + column.toLowerCase();
    const present = new Set(columns.map(c => columnKey(c.tableName, c.columnName)));
    const missing = schema.flatMap(t => t.columns.filter(c => !present.has(columnKey(t.name,c))));
    if (missing.length) return NextResponse.json({ok:false,database:"connected",schema:"incomplete",missingColumns:missing.length},{status:503,headers});
    const tenantId = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
    const tenant = tenantId ? await db.tenant.findUnique({where:{id:tenantId},select:{id:true,name:true}}) : await db.tenant.findFirst({orderBy:{createdAt:"asc"},select:{id:true,name:true}});
    const t = tenant?.id;
    const [locations,employees,customers,pets,tickets] = t ? await Promise.all([db.location.count({where:{tenantId:t}}),db.user.count({where:{tenantId:t}}),db.customer.count({where:{tenantId:t}}),db.pet.count({where:{tenantId:t}}),db.ticket.count({where:{tenantId:t}})]) : [0,0,0,0,0];
    return NextResponse.json({ok:true,database:"connected",schema:"ready",tableCount:schema.length,setupRequired:!tenant,tenant,counts:{locations,employees,customers,pets,tickets},responseMs:Date.now()-started},{headers});
  } catch (error) {
    const diagnostic = databaseFailure(error);
    console.error("Database health check failed.", diagnostic);
    return NextResponse.json({ok:false,database:"unavailable",diagnostic,error:"Database health check failed.",responseMs:Date.now()-started},{status:503,headers});
  }
}
