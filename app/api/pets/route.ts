import {writeAudit} from '@/src/lib/audit';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID;
export async function GET(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
 const q=(r.nextUrl.searchParams.get('q')||'').trim();
 const pets=await db.pet.findMany({where:{tenantId,active:true,customer:{tenantId,active:true},...(q?{OR:[{name:{contains:q}},{breed:{contains:q}},{customer:{firstName:{contains:q}}},{customer:{lastName:{contains:q}}}]}:{})},include:{customer:{select:{id:true,firstName:true,lastName:true}},vaccinations:true},orderBy:{name:'asc'},take:100});
 return NextResponse.json({pets});
}
async function save(r:NextRequest,editing:boolean){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
 const sid=r.cookies.get('groompro_session')?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json();const customerId=String(b.customerId||''),name=String(b.name||'').trim(),breed=String(b.breed||'').trim(),notes=String(b.notes||'').trim();
 if(!name||name.length>191||breed.length>191||notes.length>10000)return NextResponse.json({error:'Pet name is required. Names and breeds may contain up to 191 characters; notes up to 10,000.'},{status:400});
 const owner=await db.customer.findFirst({where:{id:customerId,tenantId,active:true},select:{id:true}});if(!owner)return NextResponse.json({error:'Customer not found.'},{status:404});
 const preferredPackageId=b.preferredPackageId===undefined?undefined:String(b.preferredPackageId||'').trim()||null;
 if(preferredPackageId&&!await db.package.findFirst({where:{id:preferredPackageId,tenantId,active:true}}))return NextResponse.json({error:'Choose an active package for this business.'},{status:400});
 const data={...(b.vipEligible!==undefined?{vipEligible:b.vipEligible===true}:{}),...(b.vipEligibilityNotes!==undefined?{vipEligibilityNotes:String(b.vipEligibilityNotes).trim()||null}:{}),...(b.groomingNotes!==undefined?{groomingNotes:String(b.groomingNotes).trim()||null}:{}),name,breed:breed||null,notes:notes||null,...(preferredPackageId!==undefined?{preferredPackageId}:{})};
 if(editing){const id=String(b.id||'');const result=await db.pet.updateMany({where:{id,tenantId,customerId,active:true},data});if(!result.count)return NextResponse.json({error:'Pet not found for this customer.'},{status:404});await writeAudit({tenantId,actorUserId:session.user.id,entityType:'PET',entityId:id,customerId,action:'EDIT',summary:'Updated pet '+name+'.'});return NextResponse.json({pet:await db.pet.findFirst({where:{id,tenantId,customerId},include:{vaccinations:true}})})}
 const pet=await db.pet.create({data:{...data,tenantId,customerId},include:{vaccinations:true}});await writeAudit({tenantId,actorUserId:session.user.id,entityType:'PET',entityId:pet.id,customerId,action:'CREATE',summary:'Added pet '+name+'.'});return NextResponse.json({pet},{status:201});
 }catch{return NextResponse.json({error:'Could not save pet. Please retry.'},{status:400})}
}
export const POST=(r:NextRequest)=>save(r,false);
export const PATCH=(r:NextRequest)=>save(r,true);
