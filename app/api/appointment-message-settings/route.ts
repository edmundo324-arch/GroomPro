import {db} from '@/src/lib/db';
import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readAppointmentMessageSettings,saveAppointmentMessageSettings} from '@/src/lib/appointment-message-store';
async function handle(r:NextRequest){
 const session=await platformSession(r),reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!session)return reply({error:'Employee PIN is required.'},401);
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return reply({error:'Ask an owner or manager to change appointment message rules.'},403);
 try{
  if(r.method==='GET'){const settings=await readAppointmentMessageSettings(session.tenantId),runtime=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:session.tenantId,settingKey:'APPOINTMENT_MESSAGE_RUNTIME'}}});return reply({...settings,runtime:runtime?.value||null});}
  const b=await r.json();return reply(await saveAppointmentMessageSettings(session.tenantId,session.user.id,b.revision,b.policy));
 }catch(e){return reply({error:e instanceof Error?e.message:'Could not save appointment message rules. Try again.'},400);}
}
export const GET=withRequestPolicy(handle,{configure:true,feature:'MESSAGING'});
export const PUT=withRequestPolicy(handle,{configure:true,feature:'MESSAGING'});
