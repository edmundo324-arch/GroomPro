import { db } from "./db";

export async function getTenantById(tenantId: string) {
  return db.tenant.findUnique({ where: { id: tenantId } });
}

export async function getLocationForTenant(tenantId: string, locationId: string) {
  return db.location.findFirst({ where: { id: locationId, tenantId } });
}

export async function getCustomerForTenant(tenantId: string, customerId: string) {
  return db.customer.findFirst({ where: { id: customerId, tenantId } });
}
