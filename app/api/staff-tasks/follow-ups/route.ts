import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {hidePlatformOwners,withRequestPolicy} from '@/src/lib/request-policy';
import {taskManager} from '@/src/lib/staff-tasks';
import {taskFollowUps,stopTaskFollowUp} from '@/src/lib/task-follow-ups';
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 try{const input=r.method==='GET'?{taskId:r.nextUrl.searchParams.get('taskId')}:await r.json();
  if(typeof input.taskId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.taskId))throw Error('Open a saved task to review its follow-ups.');
  const access={userId:session.user.id,manager:taskManager(session.user.role),hideOwners:await hidePlatformOwners(r,session.tenantId)};
  const data=r.method==='GET'?await taskFollowUps(db,session.tenantId,input.taskId,access):await stopTaskFollowUp(db,session.tenantId,input,access);
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'CALENDAR'});
export const PATCH=withRequestPolicy(handle,{feature:'CALENDAR'});
