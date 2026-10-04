import {headers} from 'next/headers';
import {workflowSettings} from './workflow-settings';
import { randomBytes } from "node:crypto";
import { db } from "./db";

export function createDeviceId() {
  return randomBytes(24).toString("hex");
}

export async function startEmployeeSession(tenantId: string, userId: string, deviceId: string) {
  await db.employeeSession.updateMany({
    where: { tenantId, deviceId, endedAt: null },
    data: { endedAt: new Date() },
  });

  return db.employeeSession.create({
    data: { tenantId, userId, deviceId },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true, active: true } } },
  });
}

export async function endEmployeeSession(tenantId: string, sessionId: string) {
  return db.employeeSession.updateMany({
    where: { id: sessionId, tenantId, endedAt: null },
    data: { endedAt: new Date() },
  });
}

export async function getActiveEmployeeSession(tenantId: string, sessionId: string) {
  const session=await db.employeeSession.findFirst({
    where: { id: sessionId, tenantId, endedAt: null, user: { active: true } },
    include: { user: { select: { id: true, tenantId: true, firstName: true, lastName: true, role: true, active: true } } },
  });
  if(!session)return null;const settings=await workflowSettings(tenantId);const now=new Date();
  if(+now-+session.lastActiveAt>settings.inactivityMinutes*60000)return null;
  const method=(await headers()).get('x-groompro-method')||'GET';
  if(settings.securityMode==='PER_ACTION'&&!['GET','HEAD','OPTIONS'].includes(method)){const claim=await db.employeeSession.updateMany({where:{id:sessionId,tenantId,endedAt:null,actionUsedAt:null},data:{actionUsedAt:now,lastActiveAt:now}});if(!claim.count)return null;}
  else await db.employeeSession.updateMany({where:{id:sessionId,tenantId,endedAt:null},data:{lastActiveAt:now}});
  return session;
}
