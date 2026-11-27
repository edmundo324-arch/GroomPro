import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

export const offlineTransaction = new AsyncLocalStorage<{ tx: Prisma.TransactionClient; recordId: string; checkedInAt?: Date }>();
export function offlineCheckedInAt() { return offlineTransaction.getStore()?.checkedInAt; }
export function offlineCreateId() {
  return offlineTransaction.getStore()?.recordId;
}

export function offlineLineId(index: number) {
  const recordId = offlineCreateId();
  return recordId ? recordId + '-line-' + index : undefined;
}
