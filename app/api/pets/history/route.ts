import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',petId=r.nextUrl.searchParams.get('petId')||'';
 if(!await db.pet.findFirst({where:{id:petId,tenantId}}))return NextResponse.json({error:'Pet not found.'},{status:404});
 const after=r.nextUrl.searchParams.get('after')||'';
 const tickets=await db.ticket.findMany({where:{tenantId,OR:[{pets:{some:{petId}}},{lines:{some:{petId}}}]},select:{id:true,orderNumber:true,scheduledStart:true,status:true,customer:{select:{firstName:true,lastName:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],...(after?{cursor:{id:after},skip:1}:{}),take:51});
 return NextResponse.json({tickets:tickets.slice(0,50),next:tickets.length>50?tickets[49].id:null},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(handle,{feature:'PETS'});
