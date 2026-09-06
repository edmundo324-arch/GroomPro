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
  return db.employeeSession.findFirst({
    where: { id: sessionId, tenantId, endedAt: null, user: { active: true } },
    include: { user: { select: { id: true, tenantId: true, firstName: true, lastName: true, role: true, active: true } } },
  });
}
