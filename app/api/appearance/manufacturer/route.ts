import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
import {manufacturerColorId} from '@/src/lib/manufacturer-colors';
import {factoryStyles,validateStyles} from '@/src/lib/calendar-presentation';
import {writeAudit} from '@/src/lib/audit';
export async function PUT(r:NextRequest){
 const session=await platformSession(r);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!isPlatformAdmin(session))return NextResponse.json({error:'GroomPro platform administrator permission is required.'},{status:403});
 try{
  const b=await r.json(),statusStyles={...factoryStyles(),...validateStyles(b.statusStyles)},tenantId=session.user.tenantId;
  await db.tenantSetting.upsert({where:{id:manufacturerColorId},create:{id:manufacturerColorId,tenantId,settingKey:'MANUFACTURER_COLORS',value:{statusStyles}},update:{value:{statusStyles}}});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'MANUFACTURER_COLORS',summary:'Updated GroomPro manufacturer colors.'});
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}
