"use client";
import { offlineAction, offlineScopeKey, offlineTargetKey, type OfflineCommand, type OfflineScope } from './offline-actions';
import { deviceRead, deviceUpdate, emptyOutbox, outboxKey, snapshotKey, type OfflineOutbox } from './offline-device-store';
import { findRecord, offlineReadRecords, projectOffline, type OfflineRecords } from './offline-records';

const activeKey = 'active-employee';
const lookups = ['/api/catalog', '/api/operating-hours', '/api/workflow-settings', '/api/customer-display', '/api/pet-display', '/api/breeds', '/api/features'];
type ActiveDevice = { scope: OfflineScope; validUntil: number };
let syncing: Promise<void> | null = null;
let preparing: Promise<void> | null = null;
let preparingScope = '';
let identityRevision = 0;
let unreachableUntil = 0;
let localAccessBlocked = false;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'X-GroomPro-Device': 'true' },
});
function change() { window.dispatchEvent(new Event('groompro:offline-changed')); }
const same = (left: OfflineScope, right: OfflineScope) => offlineScopeKey(left) === offlineScopeKey(right);

async function activeDevice(): Promise<ActiveDevice | undefined> {
  if (localAccessBlocked) return;
  try {
    const active = await deviceRead<ActiveDevice>(activeKey);
    if (active && active.validUntil > Date.now()) return active;
  } catch { /* Storage may be unavailable in a private window. */ }
}

export async function offlineStatus() {
  const active = await activeDevice();
  if (!active) return { ready: false, pending: [], archived: [], lastSaved: 0, signInRequired: false };
  const [state, queue] = await Promise.all([
    deviceRead<OfflineRecords>(snapshotKey(active.scope)),
    deviceRead<OfflineOutbox>(outboxKey(active.scope)),
  ]);
  return { ready: Boolean(state), pending: queue?.pending || [], archived: queue?.archived || [], lastSaved: state?.fetchedAt || 0, signInRequired: Boolean(queue?.signInRequired) };
}

export async function stopOfflineAccess() {
  localAccessBlocked = true;
  identityRevision++;
  await deviceUpdate<ActiveDevice>(activeKey, () => undefined).catch(() => {});
  change();
}

async function refreshDevice(scope: OfflineScope) {
  const revision = identityRevision;
  const existing = await deviceRead<OfflineRecords>(snapshotKey(scope));
  const previous = await deviceRead<OfflineOutbox>(outboxKey(scope));
  // Preserve the bases used by device edits until every pending change is confirmed.
  if (existing && previous?.pending.length) return;
  const response = await fetch('/api/offline/snapshot?' + new URLSearchParams({ locationId: scope.locationId }), { cache: 'no-store' });
  if (!response.ok) return;
  const snapshot: OfflineRecords = await response.json();
  if (!same(scope, snapshot.scope) || revision !== identityRevision) return;
  const requestLookups = [...lookups,
    '/api/calendar?' + new URLSearchParams({ start: snapshot.start, end: new Date(+new Date(snapshot.start) + 86400000).toISOString(), locationId: scope.locationId }),
    '/api/offline/staff?' + new URLSearchParams({ locationId: scope.locationId }),
  ];
  const results = await Promise.all(requestLookups.map(async url => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return [url.split('?')[0].replace('/offline/staff', '/employees'), await res.json()] as const;
    } catch { /* Keep the last complete copy. */ }
    return null;
  }));
  snapshot.lookups = { ...existing?.lookups, ...Object.fromEntries(results.filter(result => result !== null)) };
  if (!['/api/catalog', '/api/operating-hours', '/api/calendar', '/api/employees'].every(url => snapshot.lookups[url])) return;
  const latest = await deviceRead<OfflineOutbox>(outboxKey(scope));
  if (latest?.pending.length || latest?.confirmed.at(-1)?.command.id !== previous?.confirmed.at(-1)?.command.id || revision !== identityRevision) return;
  await deviceUpdate<OfflineRecords>(snapshotKey(scope), () => snapshot);
  const confirmed = new Set(previous?.confirmed.map(entry => entry.command.id));
  await deviceUpdate<OfflineOutbox>(outboxKey(scope), queue => queue && ({
    ...queue, confirmed: queue.confirmed.filter(entry => !confirmed.has(entry.command.id)),
  }));
  await deviceUpdate<ActiveDevice>(activeKey, current => revision === identityRevision ? {
    scope, validUntil: Date.now() + 12 * 60 * 60 * 1000,
  } : current);
  if (revision === identityRevision) localAccessBlocked = false;
  if (typeof navigator.storage?.persist === 'function') void navigator.storage.persist().catch(() => {});
  change();
}

export function prepareOffline(scope: OfflineScope) {
  const key = offlineScopeKey(scope);
  if (preparing && preparingScope === key) return preparing;
  preparingScope = key;
  const task = (async () => {
    if (!navigator.onLine) return;
    const current = await activeDevice();
    if (current && !same(current.scope, scope)) await stopOfflineAccess();
    // A fresh online sign-in for this same employee also unlocks an outbox
    // whose prior offline session expired.
    const saved = await deviceRead<OfflineRecords>(snapshotKey(scope));
    if (saved) {
      const revision = identityRevision;
      await deviceUpdate<ActiveDevice>(activeKey, current => revision === identityRevision ? ({ scope, validUntil: Date.now() + 12 * 60 * 60 * 1000 }) : current);
      if (revision === identityRevision) localAccessBlocked = false;
    }
    await refreshDevice(scope);
    void syncOffline();
  })().catch(() => change());
  preparing = task;
  void task.finally(() => { if (preparing === task) preparing = null; });
  return task;
}

async function projected(active: ActiveDevice) {
  const snapshot = await deviceRead<OfflineRecords>(snapshotKey(active.scope));
  if (!snapshot) return null;
  const queue = await deviceRead<OfflineOutbox>(outboxKey(active.scope)) || emptyOutbox();
  for (const entry of queue.confirmed) {
    try {
      projectOffline(snapshot, entry.command);
      for (const [key, version] of Object.entries(entry.result.offlineVersions || {})) {
        const colon = key.indexOf(':');
        const record = findRecord(snapshot, key.slice(0, colon), key.slice(colon + 1));
        if (record) record.updatedAt = version;
      }
      if (entry.result.ticket) {
        const record = findRecord(snapshot, 'ticket', entry.result.ticket.id);
        if (record) Object.assign(record, entry.result.ticket);
      }
    } catch { /* The cloud receipt still confirms the saved operation. */ }
  }
  for (const command of queue.pending) {
    try { projectOffline(snapshot, command); } catch { /* Keep the original command available for review. */ }
  }
  return { snapshot, queue };
}

export async function offlineBootstrap() {
  const active = await activeDevice();
  const state = active && await deviceRead<OfflineRecords>(snapshotKey(active.scope));
  return state ? { employee: state.employee, scope: state.scope, features: state.lookups['/api/features']?.features || [] } : null;
}

function sendCommand(command: OfflineCommand, version: OfflineCommand['version'], live?: RequestInit) {
  const url = new URL(command.url, window.location.origin);
  if (!url.searchParams.has('locationId')) url.searchParams.set('locationId', command.locationId);
  const metadata = { id: command.id, tenantId: command.tenantId, locationId: command.locationId, employeeId: command.employeeId, version, live: Boolean(live) };
  const headers = new Headers(live?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-groompro-offline', encodeURIComponent(JSON.stringify(metadata)));
  if (command.overrides?.length) headers.set('x-groompro-scheduling-overrides', encodeURIComponent(JSON.stringify(command.overrides)));
  return fetch(url, { ...live, method: command.method, body: command.body || '{}', headers, cache: 'no-store' });
}

async function confirmCommand(key: string, command: OfflineCommand, result: any) {
  await deviceUpdate<OfflineOutbox>(key, latest => {
    if (!latest?.pending.some(entry => entry.id === command.id)) return latest;
    return { ...latest, signInRequired: false, pending: latest.pending.filter(entry => entry.id !== command.id),
      confirmed: [...latest.confirmed, { command, result }] };
  });
}

async function saveOnDevice(active: ActiveDevice, url: URL, method: string, raw: string, live?: RequestInit) {
  const body = JSON.parse(raw || '{}');
  const action = offlineAction(url, method, body);
  if (!action) return json({ error: 'This action needs a connection. Your other offline changes are still saved.' }, 409);
  const data = await projected(active);
  if (!data) {
    if (live) return fetch(url, live);
    return json({ error: 'Open GroomPro online to prepare this device for offline work.' }, 409);
  }
  const target = action.target;
  const record = target && findRecord(data.snapshot, target.entity, target.id);
  const command: OfflineCommand = {
    ...active.scope, id: crypto.randomUUID(), url: url.pathname + url.search, method, body: raw,
    version: record?.updatedAt || null, createdAt: Date.now(),
  };
  let result;
  try { result = projectOffline(data.snapshot, command); }
  catch (error) { if (live) return fetch(url, live); throw error; }
  if ('error' in result && result.error) return live ? fetch(url, live) : json(result, 409);
  const key = outboxKey(active.scope);
  await deviceUpdate<OfflineOutbox>(key, existing => {
    const queue = existing || emptyOutbox();
    const dependsOn = target && [...queue.pending].reverse().find(prior => {
      const route = new URL(prior.url, window.location.origin);
      const priorBody = JSON.parse(prior.body || '{}');
      const priorAction = offlineAction(route, prior.method, priorBody);
      if (priorAction?.target && offlineTargetKey(priorAction.target) === offlineTargetKey(target)) return true;
      if (target.entity === 'ticket' && (priorBody.draft?.draftId === target.id || route.pathname === '/api/tickets' && prior.method === 'POST' && priorBody.draftId === target.id)) return true;
      return target.id === 'offline-' + prior.id;
    });
    if (dependsOn) command.follows = dependsOn.id;
    if (live && !queue.pending.length) command.directUntil = Date.now() + 65000;
    return { ...queue, pending: [...queue.pending, command] };
  });
  if (command.directUntil) {
    let response: Response | undefined;
    try { response = await sendCommand(command, command.version, live); }
    catch { unreachableUntil = Date.now() + 15000; }
    if (response?.ok) {
      try {
        await confirmCommand(key, command, await response.clone().json());
        change();
        return response;
      } catch { /* If the receipt is interrupted, retry the same command. */ }
    } else if (response && response.status < 500 && response.status !== 429) {
      await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
        ...latest, pending: latest.pending.filter(entry => entry.id !== command.id),
      }));
      change();
      return response;
    }
    await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
      ...latest, pending: latest.pending.map(entry => entry.id === command.id ? { ...entry, directUntil: undefined } : entry),
    }));
    change();
    return json({ ...result, offlinePending: true }, 202);
  }
  change();
  if (navigator.onLine) void syncOffline();
  return json({ ...result, offlinePending: true }, 202);
}

export async function deviceFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(input, init);
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return fetch(input, init);
  const method = (init?.method || 'GET').toUpperCase();
  const read = method === 'GET';
  const offline = !navigator.onLine || Date.now() < unreachableUntil;
  const active = offline || !read ? await activeDevice() : undefined;
  if (!read && (offline || active)) {
    const raw = typeof init?.body === 'string' ? init.body : '';
    if (active) {
      const queue = await deviceRead<OfflineOutbox>(outboxKey(active.scope)).catch(() => undefined);
      const supported = !init?.body || typeof init.body === 'string';
      let allowed = false;
      try { allowed = supported && Boolean(offlineAction(url, method, JSON.parse(raw || '{}'))); } catch {}
      if (offline || allowed && queue?.pending.length) {
        if (!supported) return json({ error: 'This upload needs a connection.' }, 409);
        try { return await saveOnDevice(active, url, method, raw); }
        catch (error) { return json({ error: (error as Error).message || 'This device could not save the change.' }, 409); }
      }
      if (allowed && !offline) return saveOnDevice(active, url, method, raw, init || { method });
    } else if (offline) return json({ error: 'Sign in online to prepare this device for offline saves.' }, 409);
  }
  if (!read) return fetch(input, init);
  async function localRead() {
    const device = active || await activeDevice();
    const data = device && await projected(device);
    if (data) {
      try {
        const value = offlineReadRecords(data.snapshot, url);
        if (value !== undefined) return json(value);
      } catch (error) { return json({ error: (error as Error).message }, 404); }
    }
    return json({ error: 'This information is not available on this device.' }, 503);
  }
  if (offline) return localRead();
  try {
    if (!url.pathname.startsWith('/api/employee/')) {
      const device = await activeDevice();
      const queue = device && await deviceRead<OfflineOutbox>(outboxKey(device.scope));
      if (queue?.pending.length && device) {
        const result = await localRead();
        if (result.ok) return result;
      }
    }
    const response = await fetch(input, init);
    if (response.status < 500 || init?.signal?.aborted) return response;
    const fallback = await localRead();
    return fallback.ok ? fallback : response;
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    unreachableUntil = Date.now() + 15000;
    return localRead();
  }
}

export function syncOffline() {
  if (syncing) return syncing;
  const run = async () => {
    if (!navigator.onLine) return;
    const active = await activeDevice();
    if (!active) return;
    const key = outboxKey(active.scope);
    let completed = false;
    for (;;) {
      const queue = await deviceRead<OfflineOutbox>(key);
      const command = queue?.pending[0];
      if (!command) break;
      if (command.issue || (command.directUntil || 0) > Date.now()) return;
      const session = await activeDevice();
      if (!session || !same(session.scope, active.scope)) return;
      const url = new URL(command.url, window.location.origin);
      const target = offlineAction(url, command.method, JSON.parse(command.body || '{}'))?.target;
      const prior = queue?.confirmed.find(entry => entry.command.id === command.follows);
      const version = target && prior?.result.offlineVersions?.[offlineTargetKey(target)] || command.version;
      const response = await sendCommand(command, version);
      unreachableUntil = 0;
      if (response.status >= 500 || response.status === 429) return;
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          await deviceUpdate<OfflineOutbox>(key, latest => latest && ({ ...latest, signInRequired: true }));
          change();
          return;
        }
        await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
          ...latest, pending: latest.pending.map(entry => entry.id === command.id ? {
            ...entry, issue: result.error || 'Review this offline change.', cloud: result.cloud, warning: result.schedulingWarning,
          } : entry),
        }));
        change();
        return;
      }
      await confirmCommand(key, command, result);
      completed = true;
      change();
    }
    if (completed) {
      await refreshDevice(active.scope);
      window.dispatchEvent(new CustomEvent('groompro:data-changed', { detail: { url: '/api/customers' } }));
      window.dispatchEvent(new CustomEvent('groompro:data-changed', { detail: { url: '/api/pets' } }));
      window.dispatchEvent(new CustomEvent('groompro:ticket-changed'));
    }
  };
  syncing = run().catch(() => {}).finally(() => { syncing = null; });
  return syncing;
}

export async function reviewOffline(id: string, resolution: 'retry' | 'device' | 'cloud' | 'warning') {
  const active = await activeDevice();
  if (!active) return;
  const key = outboxKey(active.scope);
  const queue = await deviceRead<OfflineOutbox>(key);
  const command = queue?.pending.find(entry => entry.id === id);
  if (!command?.issue) return;
  await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
    ...latest,
    ...(resolution === 'cloud' ? { archived: [...(latest.archived || []), command] } : {}),
    pending: latest.pending.flatMap(entry => {
      if (entry.id !== id) return [entry];
      if (resolution === 'cloud') return [];
      return [{
        ...entry, issue: undefined, cloud: undefined,
        ...(resolution === 'device' ? { version: (entry.cloud as any)?.updatedAt, follows: undefined } : {}),
        ...(resolution === 'warning' && entry.warning ? { overrides: [...(entry.overrides || []), entry.warning] } : {}),
      }];
    }),
  }));
  change();
  void syncOffline();
}
