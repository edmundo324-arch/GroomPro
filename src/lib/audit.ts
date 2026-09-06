import { AuditActorType, AuditEntityType } from "@prisma/client";
import { db } from "./db";

type AuditInput = {
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  summary: string;
  customerId?: string;
  actorUserId?: string;
  details?: unknown;
};

export async function writeAudit(input: AuditInput) {
  return db.auditEntry.create({
    data: {
      tenantId: input.tenantId,
      actorType: input.actorUserId ? AuditActorType.EMPLOYEE : AuditActorType.SYSTEM,
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      customerId: input.customerId,
      action: input.action,
      summary: input.summary,
      details: input.details as object | undefined,
    },
  });
}

export async function getItemLedger(tenantId: string, entityType: AuditEntityType, entityId: string) {
  return db.auditEntry.findMany({
    where: { tenantId, entityType, entityId },
    include: { actorUser: { select: { firstName: true, lastName: true } } },
    orderBy: { occurredAt: "desc" },
  });
}

export async function getCustomerLedger(tenantId: string, customerId: string) {
  return db.auditEntry.findMany({
    where: { tenantId, customerId },
    include: { actorUser: { select: { firstName: true, lastName: true } } },
    orderBy: { occurredAt: "desc" },
  });
}
