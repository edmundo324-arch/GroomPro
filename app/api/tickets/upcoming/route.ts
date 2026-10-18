import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
export async function GET(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const locationId=await requestLocation(request,tenantId),customerId=request.nextUrl.searchParams.get('customerId')||'';
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context is required.'},{status:401});
 const tickets=await db.ticket.findMany({where:{tenantId,locationId,customerId,scheduledStart:{gte:new Date()},status:{notIn:['CANCELLED','NO_SHOW']}},orderBy:{scheduledStart:'asc'},select:{bookingAssetId:true,id:true,orderNumber:true,scheduledStart:true,assignments:{where:{role:'GROOMER'},select:{user:{select:{displayName:true,firstName:true,lastName:true}}}},lines:{select:{description:true}}}});
 const assets=await db.$queryRaw<{id:string;name:string}[]>`SELECT id,name FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId}`;
 return NextResponse.json({tickets:tickets.map(t=>({...t,bookingAssetName:assets.find(a=>a.id===t.bookingAssetId)?.name||null}))});
}
