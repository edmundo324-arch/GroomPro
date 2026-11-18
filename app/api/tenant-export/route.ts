import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {tenantExport} from '@/src/lib/tenant-export';
async function get(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(s.user.role))return NextResponse.json({error:'Business owner or administrator access is required to export business records.'},{status:403});try{const data=await db.$transaction(tx=>tenantExport(tx,s.tenantId),{isolationLevel:'RepeatableRead',timeout:120000});await db.auditEntry.create({data:{tenantId:s.tenantId,actorType:'EMPLOYEE',actorUserId:s.user.id,entityType:'TENANT',entityId:s.tenantId,action:'PORTABLE_EXPORT',summary:'Downloaded readable business records.',details:{tables:Object.keys(data.tables),warnings:data.warnings}}});return new NextResponse(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="GroomPro-records.json"','Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'The export could not finish. Your records have not changed. Please try again.'},{status:500});}}
export const GET=withRequestPolicy(get);
