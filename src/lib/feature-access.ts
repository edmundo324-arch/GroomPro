import {isPlatformRole} from '@/src/lib/roles';
import {customerContactFeature,entitled,hasConfiguredPlan} from './platform-access';
import { db } from "@/src/lib/db";
import type { GroomProPermission, GroomProRole } from "@/src/lib/roles";

export {customerContactFeature};

export async function isFeatureEnabled(tenantId: string, featureCode: string) {
  const row = await db.tenantFeature.findUnique({ where: { tenantId_featureCode: { tenantId, featureCode } } });
  if(row?.enabled===false)return false;
  const subscription=await db.subscription.findUnique({where:{tenantId}});
  if (featureCode === customerContactFeature) {
    if (!subscription) return true;
    if (subscription.status !== 'active') return false;
    return !!await db.planFeature.findUnique({
      where: { planCode_featureCode: { planCode: subscription.plan, featureCode } },
    });
  }
  return subscription&&await hasConfiguredPlan(tenantId)?await entitled(tenantId,featureCode):true;
}

export async function hasRolePermission(tenantId: string, role: GroomProRole, permissionCode: GroomProPermission) {
  if(isPlatformRole(role))return true;
  const row = await db.rolePermission.findUnique({ where: { tenantId_role_permissionCode: { tenantId, role, permissionCode } } });
  return row?.enabled === true;
}
