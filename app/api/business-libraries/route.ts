import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {libraryKey,validateLibrary} from '@/src/lib/business-libraries';
async function get(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});try{const key=libraryKey(r.nextUrl.searchParams.get('kind')||'');const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:s.tenantId,settingKey:key}}});return NextResponse.json(row?.value||{revision:0,rows:[]},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
async function put(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});try{const b=await r.json(),key=libraryKey(b.kind),rows=validateLibrary(b.kind,b.rows);const result=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${s.tenantId} FOR UPDATE`;
 const where={tenantId_settingKey:{tenantId:s.tenantId,settingKey:key}},old=await tx.tenantSetting.findUnique({where}),revision=(old?.value as any)?.revision||0;
 if(b.revision!==revision)throw Error('Someone changed this library. Your entries are still on screen; reopen the library to review the saved version before saving.');
 if(b.kind==='vendors'){const ids=[...new Set(rows.flatMap((x:any)=>x.productIds))] as string[];if(await tx.product.count({where:{tenantId:s.tenantId,id:{in:ids}}})!==ids.length)throw Error('A selected product is no longer available in this business. Review the product choices.');}
 const value={revision:revision+1,rows};await tx.tenantSetting.upsert({where,create:{tenantId:s.tenantId,settingKey:key,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId:s.tenantId,actorType:'EMPLOYEE',actorUserId:s.user.id,entityType:'TENANT',entityId:s.tenantId,action:'BUSINESS_LIBRARY_UPDATED',summary:'Updated '+b.kind,details:{count:rows.length,revision:revision+1}}});return value;});return NextResponse.json(result);}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(get);
export const PUT=withRequestPolicy(put,{configure:true});
