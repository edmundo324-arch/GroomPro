import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {petPrepaidPackages,prepaidRevision} from '@/src/lib/prepaid-transfer';
import {transferPet} from '@/src/lib/pet-transfer';
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');
 if(!session)return NextResponse.json({error:'Enter your employee PIN to transfer this pet.'},{status:401});
 try{const b=await r.json();const pet=await db.$transaction(tx=>transferPet(tx,tenantId,session.user.id,{petId:String(b.petId||''),customerId:String(b.customerId||''),newCustomerId:String(b.newCustomerId||''),prepaidDecisions:b.prepaidDecisions}));return NextResponse.json({pet});}
 catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}
}
export const PATCH=withRequestPolicy(handle,{feature:'PETS'});

export const GET=withRequestPolicy(async(r:NextRequest)=>{
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');
 if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 const pet=await db.pet.findFirst({where:{tenantId,id:r.nextUrl.searchParams.get('petId')||''}});
 if(!pet)return NextResponse.json({error:'This dog is not available.'},{status:404});
 const packages=await petPrepaidPackages(db,tenantId,pet.id,pet.customerId);
 return NextResponse.json({packages:packages.map((p:any)=>({id:p.id,name:p.offer.name,visits:p.visitsRemaining,state:p.state,revision:prepaidRevision(p)}))},{headers:{'Cache-Control':'no-store'}});
},{feature:'PETS'});
