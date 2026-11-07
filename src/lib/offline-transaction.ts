import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

export const offlineTransaction = new AsyncLocalStorage<{ tx: Prisma.TransactionClient; recordId: string }>();
export function offlineCreateId() {
  return offlineTransaction.getStore()?.recordId;
}

export function offlineLineId(index: number) {
  const recordId = offlineCreateId();
  return recordId ? recordId + '-line-' + index : undefined;
}
