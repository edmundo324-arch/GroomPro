import {NextRequest,NextResponse} from 'next/server';
import {platformSession,isPlatformAdmin,entitled} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {groomingExperienceFeature} from '@/src/lib/grooming-experience';
import {readCareInstructions,saveCareInstructions} from '@/src/lib/grooming-instructions';
async function handle(r:NextRequest){const s=await platformSession(r),reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!s)return reply({error:'Enter your employee PIN.'},401);
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role))return reply({error:'Ask an owner or manager to edit the shop’s care instructions.'},403);
 if(!isPlatformAdmin(s)&&!await entitled(s.tenantId,groomingExperienceFeature))return reply({error:'This business’s subscription does not include the seven-stage grooming workflow.'},403);
 try{if(r.method==='GET')return reply(await readCareInstructions(s.tenantId));const b=await r.json();return reply(await saveCareInstructions(s.tenantId,s.user.id,b.revision,b.stages));}catch(e){return reply({error:(e as Error).message},409);}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
