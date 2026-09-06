import { getCustomerLedger } from "./audit";

export async function getCustomerLedgerForProfile(tenantId: string, customerId: string) {
  return getCustomerLedger(tenantId, customerId);
}
