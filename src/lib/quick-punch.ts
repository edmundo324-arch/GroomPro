import {NextRequest,NextResponse} from 'next/server';
import {db} from './db';
import {isFeatureEnabled} from './feature-access';
import {isPlatformRole} from './roles';
import {requestLocation} from './request-location';
import {saveTimeClock} from './save-time-clock';
import type {User} from '@prisma/client';

export async function recordQuickPunch(request:NextRequest,tenantId:string,user:User,action:'IN'|'OUT'){
 if(!isPlatformRole(user.role)){
  const allowed=await isFeatureEnabled(tenantId,'CALENDAR');
  const permission=await db.rolePermission.findUnique({where:{tenantId_role_permissionCode:{tenantId,role:user.role,permissionCode:'CREATE'}}});
  if(!allowed||permission?.enabled===false)return NextResponse.json({error:'Your role or business does not have time clock access.'},{status:403});
 }
 const locationId=await requestLocation(request,tenantId);
 if(!locationId){
  const locations=await db.location.findMany({where:{tenantId},select:{id:true,name:true},orderBy:{name:'asc'}});
  return NextResponse.json({error:'Choose the shop where you are working, then enter your PIN again.',locations},{status:400});
 }
 const at=new Date().toISOString();
 try{
  await saveTimeClock(tenantId,user.id,user.id,locationId,{action},at,false,true);
 }catch(error){
  if(error instanceof Error && /^(You are already clocked in|Clock in before|Clock-in must be after|This time is before)/.test(error.message))return NextResponse.json({error:error.message},{status:409});
  throw error;
 }
 return NextResponse.json({name:user.displayName||user.firstName,action,at});
}
