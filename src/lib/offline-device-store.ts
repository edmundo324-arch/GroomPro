import { offlineScopeKey, type OfflineCommand, type OfflineScope } from './offline-actions';

export type OfflineSnapshot = {
  scope: OfflineScope; employee: { id: string; displayName?: string; role: string };
  location: { id: string; name: string; timezone: string };
  since: string; start: string; through: string; fetchedAt: number;
  customers: any[]; tickets: any[]; notes: any[]; drafts: any[];
};
export type OfflineOutbox = {
  pending: OfflineCommand[];
  confirmed: { command: OfflineCommand; result: any }[];
  signInRequired?: boolean;
  archived?: OfflineCommand[];
};

let connection: Promise<IDBDatabase> | undefined;
function openDevice() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('groompro-offline-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('device');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

export async function deviceRead<T>(key: string): Promise<T | undefined> {
  const db = await openDevice();
  return new Promise((resolve, reject) => {
    const request = db.transaction('device').objectStore('device').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deviceUpdate<T>(key: string, update: (current: T | undefined) => T | undefined): Promise<T | undefined> {
  const db = await openDevice();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('device', 'readwrite');
    const store = tx.objectStore('device');
    let value: T | undefined;
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        value = update(request.result);
        if (value === undefined) store.delete(key); else store.put(value, key);
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () => reject(tx.error || Error('Device storage could not save this change.'));
  });
}

export const snapshotKey = (scope: OfflineScope) => 'snapshot:' + offlineScopeKey(scope);
export const outboxKey = (scope: OfflineScope) => 'outbox:' + offlineScopeKey(scope);
export const emptyOutbox = (): OfflineOutbox => ({ pending: [], confirmed: [] });
