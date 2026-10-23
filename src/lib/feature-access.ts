import {entitled,hasConfiguredPlan} from './platform-access';
import { db } from "@/src/lib/db";
import type { GroomProPermission, GroomProRole } from "@/src/lib/roles";

export async function isFeatureEnabled(tenantId: string, featureCode: string) {
  const row = await db.tenantFeature.findUnique({ where: { tenantId_featureCode: { tenantId, featureCode } } });
  const subscription=await db.subscription.findUnique({where:{tenantId}});return subscription&&await hasConfiguredPlan(tenantId)?await entitled(tenantId,featureCode)&&row?.enabled!==false:row?.enabled===true;
}

export async function hasRolePermission(tenantId: string, role: GroomProRole, permissionCode: GroomProPermission) {
  const row = await db.rolePermission.findUnique({ where: { tenantId_role_permissionCode: { tenantId, role, permissionCode } } });
  return row?.enabled === true;
}
