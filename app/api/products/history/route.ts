import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {db} from '@/src/lib/db';
import {stockHistoryRow} from '@/src/lib/stock-history';
async function history(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const id=r.nextUrl.searchParams.get('productId')||'',cursor=r.nextUrl.searchParams.get('cursor')||'';
 if(!await db.product.findFirst({where:{id,tenantId},select:{id:true}}))return NextResponse.json({error:'This product could not be found. Reopen Inventory to review the current products.'},{status:404});
 const where={tenantId,entityType:'INVENTORY_ITEM' as const,entityId:id,action:{in:['STOCK_OPENING','STOCK_ADJUSTMENT','TICKET_STOCK_SALE']}};
 if(cursor&&!await db.auditEntry.findFirst({where:{...where,id:cursor},select:{id:true}}))return NextResponse.json({error:'Reopen stock history to review the latest entries.'},{status:400});
 const rows=await db.auditEntry.findMany({where,orderBy:[{occurredAt:'desc'},{id:'desc'}],take:51,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true,occurredAt:true,actorType:true,summary:true,details:true,actorUser:{select:{firstName:true,lastName:true,displayName:true,role:true}}}});
 return NextResponse.json({rows:rows.slice(0,50).map(row=>stockHistoryRow(row,['PLATFORM_OWNER','DEVELOPER'].includes(session.user.role))),nextCursor:rows.length>50?rows[49].id:null},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(history,{feature:'INVENTORY'});
