import {attendingPets} from '@/src/lib/appointment-pets';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {customerStates} from '@/src/lib/appointment-customer-state';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
async function handlePolicyGET(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const locationId=await requestLocation(request,tenantId),customerId=request.nextUrl.searchParams.get('customerId')||'';
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context is required.'},{status:401});
 const tickets=await db.ticket.findMany({where:{tenantId,locationId,customerId,scheduledStart:{not:null}},orderBy:{scheduledStart:'asc'},select:{createdAt:true,checkedInAt:true,pickupAt:true,bookingDecision:true,displayStatus:true,presentationServiceType:true,customerId:true,customer:{select:{firstName:true,lastName:true}},pets:{include:{pet:true}},status:true,bookingAssetId:true,id:true,orderNumber:true,scheduledStart:true,assignments:{where:{role:'GROOMER'},select:{user:{select:{displayName:true,firstName:true,lastName:true}}}},lines:true}});
 const assets=await db.$queryRaw<{id:string;name:string}[]>`SELECT id,name FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId}`;
 return NextResponse.json({tickets:(await customerStates(tenantId,tickets)).map(t=>({...attendingPets(t),bookingAssetName:assets.find(a=>a.id===t.bookingAssetId)?.name||null}))});
}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'TICKETS'});
